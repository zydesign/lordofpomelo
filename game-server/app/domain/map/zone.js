var util = require('util');
var EventEmitter = require('events').EventEmitter;

var id = 0;

/**
 * The origint zone object
 * 怪物空间对象的父类，mobzone将会继承该父类属性及方法
 */
var Zone = function(opts) {
	this.zoneId = id++;
	this.width = opts.width;
	this.height = opts.height;
	this.x = opts.x;
	this.y = opts.y;
  this.area = opts.area;
};

util.inherits(Zone, EventEmitter);

/**
 * Update the zone, the funciton is time driven
 * 会使用定时器调用这个函数
 */
Zone.prototype.update = function() {
};

/**
 * Remove an entity from the zone, default function will do nothing
 */
Zone.prototype.remove = function() {
};

module.exports = Zone;
