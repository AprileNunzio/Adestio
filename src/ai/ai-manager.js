const toolRegistry = new Map();

function registerTool(name, schema, handler) {
    toolRegistry.set(name, { schema, handler });
}

function getTool(name) {
    return toolRegistry.get(name);
}

export { registerTool, getTool };
