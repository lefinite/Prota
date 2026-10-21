const AgentEvents = {
    parseSseChunk(chunk) {
        if (!String(chunk || '').trim()) return null;

        const lines = String(chunk).split('\n');
        let eventName = 'message';
        const dataLines = [];

        lines.forEach((line) => {
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
            }
        });

        if (!dataLines.length) return null;

        return {
            eventName,
            payload: JSON.parse(dataLines.join('\n'))
        };
    }
};

window.AgentEvents = AgentEvents;
