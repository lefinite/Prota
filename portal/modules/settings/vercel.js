/** Browser authorization and provisioning, without an Agent or terminal. */
export class VercelConnection {
    constructor(shell) {
        this.shell = shell;
        this.panel = document.createElement('section');
        this.panel.className = 'us-vercel-connection'; this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Vercel 连接状态');
        this.panel.innerHTML = `<p data-vc-message role="status" aria-live="polite"></p><progress data-vc-progress max="4" value="0" aria-label="连接进度"></progress><a data-vc-authorize target="_blank" rel="noopener noreferrer" hidden>打开 Vercel 授权页面</a><div data-vc-dns hidden></div><div class="us-vercel-actions"><button type="button" data-vc-retry hidden>重试</button><button type="button" data-vc-cancel hidden>取消连接</button></div>`;
        this.summary = document.querySelector('#vercelConnectionSummary');
        this.summary.querySelector('[data-vc-progress-slot]').append(this.panel);
        this.summary.querySelector('[data-vc-check]').onclick = () => this.refresh();
        this.panel.querySelector('[data-vc-retry]').onclick = () => this.start();
        this.panel.querySelector('[data-vc-cancel]').onclick = async () => { await this.api('cancel', {}); await this.poll(); };
        this.updateSummary();
    }
    q(selector) { return this.panel.querySelector(selector); }
    async api(action, body) {
        const response = await fetch('/api/vercel/' + action, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || '连接失败，请重试。');
        return data;
    }
    async refresh() {
        const revision = this.checkRevision = (this.checkRevision || 0) + 1;
        this.checking = true; this.updateSummary();
        const results = await Promise.allSettled([this.api('connection'), this.api('status')]);
        if (revision !== this.checkRevision) return;
        this.checking = false;
        this.connection = results[0].status === 'fulfilled' ? results[0].value : {authState:'unknown',publishState:'unknown',message:'暂时无法检查连接，请检查本地服务或网络后重试。'};
        if (results[1].status === 'fulfilled') this.render(results[1].value);
        else this.updateSummary();
    }
    updateSummary() {
        const connection = this.connection || {};
        const job = this.job || {};
        const active = ['running', 'authorizing'].includes(job.state);
        const mode = document.querySelector('[name=shareSetup]:checked')?.value || 'vercel';
        const draft = this.shell.staticDomainInput.value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
        const matches = mode === 'custom' ? connection.domain === draft && !draft.endsWith('.vercel.app') : connection.domain?.endsWith('.vercel.app');
        const ready = connection.authState === 'authorized' && connection.publishState === 'ready';
        let state = 'pending', label = '未连接';
        let message = connection.message || '连接 Vercel 后，这里会显示授权账号和生效地址。';
        let publish = ready ? (matches ? '已生效，可直接分享' : '当前选择尚未应用，原地址仍有效') : ({unconfigured:'尚未生效',invalid:'项目配置需要处理',dns_required:'等待域名解析生效',unknown:'暂时无法验证'}[connection.publishState] || '正在检查…');
        if (this.checking) { label = '正在检查'; }
        else if (active) { label = job.state === 'authorizing' ? '待完成授权' : '连接中'; message = job.message; publish = '连接完成后自动生效'; }
        else if (ready && matches) { state = 'ready'; label = '已生效'; }
        else if (connection.authState === 'expired') { state = 'warning'; label = '需重新授权'; }
        else if (['dns_required','error','cancelled'].includes(job.state)) { state = job.state === 'cancelled' ? 'pending' : 'warning'; label = job.state === 'dns_required' ? '待验证域名' : job.state === 'error' ? '连接需处理' : '连接已取消'; message = job.message; }
        else if (ready) { label = '待应用'; message = '仅选择方式不会更改当前分享地址，完成连接后才会生效。'; }
        else if (connection.authState === 'unknown' || connection.publishState === 'unknown') { state = 'warning'; label = '无法验证'; }
        else if (connection.authState === 'authorized') { state = connection.publishState === 'unconfigured' ? 'pending' : 'warning'; label = connection.publishState === 'unconfigured' ? '已授权，待连接' : '配置需处理'; }
        this.summary.dataset.state = state;
        const badge = this.summary.querySelector('[data-vc-badge]'); badge.textContent = label;
        const auth = {authorized:`已授权 · ${connection.account || 'Vercel 账号'}`,unauthorized:'未授权',expired:'授权需更新，请重新授权',unknown:'暂时无法验证'}[connection.authState] || '正在检查…';
        this.summary.querySelector('[data-vc-account]').textContent = job.state === 'authorizing' ? '等待浏览器授权' : auth;
        this.summary.querySelector('[data-vc-effective]').textContent = publish;
        const addressRow = this.summary.querySelector('[data-vc-address-row]');
        addressRow.hidden = !ready;
        const address = this.summary.querySelector('[data-vc-address]');
        address.removeAttribute('href'); address.textContent = connection.domain || '';
        if (ready && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(connection.domain || '')) address.href = 'https://' + connection.domain;
        this.summary.querySelector('[data-vc-summary-message]').textContent = message;
        const check = this.summary.querySelector('[data-vc-check]'); check.disabled = this.checking || active;
        this.shell.vercelAutoConfigBtn.disabled = active;
        this.shell.vercelAutoConfigBtn.querySelector('strong').textContent = active ? (job.state === 'authorizing' ? '等待授权…' : '正在连接…') : connection.authState === 'expired' ? '重新授权' : ready && matches ? '重新连接' : mode === 'custom' ? '绑定域名并连接' : '连接 Vercel';
    }
    async start() {
        if (this.shell.unifiedSettings?.guardModels(() => this.start())) return;
        const custom = document.querySelector('[name=shareSetup]:checked')?.value === 'custom';
        if (custom && !this.shell.staticDomainInput.value.trim()) {
            this.shell.unifiedSettings.setFeedback('请先填写你的自有域名。', true);
            this.shell.staticDomainInput.focus();
            return;
        }
        // Connecting is the next step in this form: save its draft directly,
        // rather than making the user save and then repeat the same click.
        if (this.shell.unifiedSettings?.dirtyPanels().includes('sharing') && !await this.shell.saveSettings()) return;
        const domain = custom ? this.shell.settings.staticDomain : '';
        this.checkRevision = (this.checkRevision || 0) + 1; this.checking = false;
        try { this.render(await this.api('connect', { domain })); }
        catch (error) { this.render({ state: 'error', message: error.message }); }
    }
    async poll() {
        try { this.render(await this.api('status')); }
        catch (error) { this.render({ state: 'error', message: error.message }); }
    }
    render(data) {
        clearTimeout(this.timer); this.job = data; this.panel.hidden = ['idle','ready'].includes(data.state);
        const active = ['running', 'authorizing'].includes(data.state);
        if (active && !this.blockedInputs) {
            this.blockedInputs = new Map([...this.shell.shareSettingsForm.querySelectorAll('[name=shareSetup], #staticDomainInput, button[type=submit]')].map(input => [input, input.disabled]));
            for (const input of this.blockedInputs.keys()) input.disabled = true;
        } else if (!active && this.blockedInputs) {
            for (const [input, disabled] of this.blockedInputs) input.disabled = disabled;
            this.blockedInputs = null;
        }
        this.q('[data-vc-message]').textContent = data.message || '正在连接…';
        this.q('[data-vc-progress]').hidden = !active;
        this.q('[data-vc-progress]').value = data.step || 1;
        this.q('[data-vc-cancel]').hidden = !active;
        this.q('[data-vc-retry]').hidden = !['error', 'cancelled', 'dns_required'].includes(data.state);
        this.q('[data-vc-retry]').textContent = data.state === 'dns_required' ? '重新检查 DNS' : '重试';
        this.updateSummary();
        const auth = this.q('[data-vc-authorize]');
        auth.hidden = !data.authorizationUrl;
        if (data.authorizationUrl) {
            const url = new URL(data.authorizationUrl);
            if (url.protocol === 'https:' && url.hostname === 'vercel.com') auth.href = url.href;
            else auth.hidden = true;
        }
        const dns = this.q('[data-vc-dns]'); dns.replaceChildren(); dns.hidden = data.state !== 'dns_required';
        if (!dns.hidden) {
            const records = [...(data.verification || [])];
            for (const item of data.dns?.recommendedCNAME || []) records.push({ type: 'CNAME', domain: data.domain, value: item.value });
            for (const item of data.dns?.recommendedIPv4 || []) for (const value of item.value || []) records.push({ type: 'A', domain: data.domain, value });
            for (const record of records) {
                const line = document.createElement('p'); line.textContent = [record.type, record.domain || data.domain, record.value].filter(Boolean).join(' · '); dns.append(line);
            }
            if (!records.length) dns.textContent = 'DNS 尚未生效，请等待后重新检查。';
        }
        if (active) this.timer = setTimeout(() => this.poll(), 1200);
        if (data.state === 'ready' && this.applied !== data.id) {
            this.applied = data.id;
            this.shell.loadSettings().then(() => { this.shell.unifiedSettings?.markSaved('sharing'); this.refresh(); });
        }
    }
}
