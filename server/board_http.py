"""Local-only board version APIs. Snapshot HTML executes in an opaque sandbox."""
import json
from urllib.parse import parse_qs, unquote, urlsplit

from server import board_revisions as boards
from server.canvas_domain import feature_enabled
from server.canvas_transactions import LOCK, Conflict, page_lock, recover_transactions, inspect_transactions, resolve_transaction


def read(handler, workspace):
    is_resource = urlsplit(handler.path).path.startswith('/__prota_board_history/')
    opaque_resource = is_resource and handler.headers.get('Origin') == 'null' and handler.client_address[0] in {'127.0.0.1', '::1'} and handler.is_local_request()
    if not handler.workspace_local() and not opaque_resource:
        return handler.workspace_reply(403, {'error': '只能在本机读取画板历史'})
    if workspace.bridge_locked():
        return handler.workspace_reply(423, {'error': '工作区正在切换'})
    try:
        root = workspace.workspace_root()
        parsed = urlsplit(handler.path)
        if parsed.path.startswith('/__prota_board_history/'):
            segments = parsed.path[len('/__prota_board_history/'):].split('/')
            if len(segments) < 5:
                raise ValueError('历史资源路径不完整')
            params = dict(zip(('projectId', 'pageId', 'boardId', 'revisionId'), map(unquote, segments[:4])))
            name = unquote('/'.join(segments[4:]))
            data, content_type = boards.preview_resource(root, params, name)
            handler.send_response(200)
            handler.send_header('Content-Type', content_type)
            handler.send_header('Content-Length', str(len(data)))
            handler.send_header('Cache-Control', 'no-store')
            handler.send_header('X-Content-Type-Options', 'nosniff')
            handler._board_history_cors = True
            handler.send_header('Content-Security-Policy', 'sandbox allow-scripts allow-forms')
            handler.end_headers(); handler.wfile.write(data)
            return
        params = {key: values[0] for key, values in parse_qs(parsed.query).items()}
        if parsed.path == '/api/boards/transactions':
            page = boards.context(root, params, version=False)
            with LOCK, page_lock(page):
                return handler.workspace_reply(200, {'transactions': inspect_transactions(page)})
        result = boards.preview_revision(root, params) if parsed.path.endswith('/preview') else boards.list_revisions(root, params)
        return handler.workspace_reply(200, result)
    except Conflict as error:
        return handler.workspace_reply(409, {'error': str(error)})
    except (ValueError, OSError, TypeError, KeyError) as error:
        return handler.workspace_reply(400, {'error': str(error)})


def mutate(handler, workspace):
    if not handler.workspace_local() or not handler.headers.get('Content-Type', '').startswith('application/json'):
        return handler.workspace_reply(403, {'error': '只能在本机修改画板历史'})
    if workspace.bridge_locked():
        return handler.workspace_reply(423, {'error': '工作区正在切换'})
    try:
        length = int(handler.headers.get('Content-Length', '0'))
        if not 0 < length <= 24 * 1024 * 1024:
            return handler.workspace_reply(413, {'error': '画板请求大小无效'})
        params = json.loads(handler.rfile.read(length))
        if not isinstance(params, dict):
            raise ValueError('画板请求必须是 JSON 对象')
        root = workspace.workspace_root()
        endpoint = urlsplit(handler.path).path
        if endpoint.endswith('/recover'):
            if not feature_enabled(root, 'boardRevisions'):
                return handler.workspace_reply(403, {'error': '尚未启用 boardRevisions'})
            page = boards.context(root, params, version=False)
            with LOCK, page_lock(page):
                if params.get('resolution') is not None:
                    if params['resolution'] != 'rollback':
                        raise ValueError('仅支持显式回滚，外部内容先备份到回收站')
                    return handler.workspace_reply(200, {'recovered': [resolve_transaction(page, params.get('transactionId'), params.get('expectedCurrent'))]})
                return handler.workspace_reply(200, {'recovered': recover_transactions(page)})
        function = boards.restore_revision if endpoint.endswith('/restore') else boards.create_revision
        code, result = function(root, params)
        return handler.workspace_reply(code, result)
    except Conflict as error:
        return handler.workspace_reply(409, {'error': str(error)})
    except (ValueError, OSError, TypeError, KeyError) as error:
        return handler.workspace_reply(400, {'error': str(error)})
