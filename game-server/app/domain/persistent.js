/**
 * Module dependencies
 */
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Persistent object, it is saved in database
 *
 * @param {Object} opts
 * @api public
 */
//背包、装备、任务的基类，发射'save'同步数据库储存事件
var Persistent = function(opts) {
	this.id = opts.id;
	this.type = opts.type;
	EventEmitter.call(this);
};

util.inherits(Persistent, EventEmitter);

module.exports = Persistent;
// Emit the event 'save'
Persistent.prototype.save = function() {
	this.emit('save');
};

