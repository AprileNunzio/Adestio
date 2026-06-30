'use strict';

function topologicalSort(blocks) {
    try {
        const blockMap = new Map(blocks.map(b => [b.block_id, b]));
        const inDegree = new Map();
        const children = new Map();

        for (const b of blocks) {
            if (!inDegree.has(b.block_id)) inDegree.set(b.block_id, 0);
            if (!children.has(b.block_id)) children.set(b.block_id, []);
            const parents = Array.isArray(b.parent_ids) ? b.parent_ids : JSON.parse(b.parent_ids);
            for (const pid of parents) {
                if (pid === 'GENESIS' || !blockMap.has(pid)) continue;
                inDegree.set(b.block_id, (inDegree.get(b.block_id) || 0) + 1);
                if (!children.has(pid)) children.set(pid, []);
                children.get(pid).push(b.block_id);
            }
        }

        const _byTime = (a, b) => (blockMap.get(a)?.created_at || 0) - (blockMap.get(b)?.created_at || 0);
        const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id).sort(_byTime);
        const sorted = [];

        while (queue.length > 0) {
            const cur = queue.shift();
            const block = blockMap.get(cur);
            if (block) sorted.push(block);
            const childs = (children.get(cur) || []).sort(_byTime);
            for (const child of childs) {
                const deg = (inDegree.get(child) || 1) - 1;
                inDegree.set(child, deg);
                if (deg === 0) { queue.push(child); queue.sort(_byTime); }
            }
        }

        return sorted;
    } catch (_) { return blocks; }
}

module.exports = { topologicalSort };
