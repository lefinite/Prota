// Pi terminal builtins are deliberately absent: each is mapped to a business API.
export function mergePiCommands(protaCommands, discovered = []) {
    const commands = new Map(protaCommands.map(command => [command.id, command]));
    const reserved = new Set(protaCommands.flatMap(command => [command.id, ...(command.aliases || []).map(alias => alias.replace(/^\//, ''))]));
    for (const command of discovered) {
        const id = command.name;
        if (command.source !== 'extension' || !/^[a-z][a-z0-9-]*$/.test(id || '') || id.startsWith('prota-') || reserved.has(id)) continue;
        commands.set(id, { id, label: id, description: command.description || 'Pi 扩展命令',
            source: 'pi-extension', action: 'gateway', category: 'advanced', advanced: true,
            availability: 'available', kind: 'command', usage: `/${id} [参数]`, aliases: [], icon: 'PI',
            argumentMode: 'optional-text', supportsSession: true });
        reserved.add(id);
    }
    return [...commands.values()];
}
