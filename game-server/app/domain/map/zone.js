var util = require('util');
var EventEmitter = require('events').EventEmitter;

var id = 0;

/**
 * The origint zone object
 * 空间类，怪物空间mobzone将会继承该基类属性及方法
 */
//空间，继承事件监听器。空间就是制定场景的某个区域
var Zone = function(opts) {
	this.zoneId = id++;           //实例zone时，id递增下去
	this.width = opts.width;      //空间的宽度
	this.height = opts.height;    //空间的高度
	this.x = opts.x;              
	this.y = opts.y;
  this.area = opts.area;              //空间所在的场景
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
