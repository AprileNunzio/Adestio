'use strict';
const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100);
    }

    publish(event, data) {
        this.emit(event, data);
    }

    subscribe(event, handler) {
        this.on(event, handler);
        return () => this.off(event, handler);
    }

    subscribeOnce(event, handler) {
        this.once(event, handler);
    }
}

module.exports = new EventBus();
