/**
 * Module dependencies
 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var id = 1;

/**
 * Initialize a new 'Entity' with the given 'opts'.
 * Entity inherits EventEmitter
 *
 * @param {Object} opts
 * @api public
 */

var Entity = function(opts) {
  //让实体继承事件派发器，可以使用EventEmitter的属性和方法了
  EventEmitter.call(this);
  this.entityId = id++;//让每new一次的实例id递增不相同
  this.kindId = Number(opts.kindId);
  this.kindName = opts.kindName;
  this.englishName = opts.englishName;
  this.type = opts.type;
  this.x = opts.x;
  this.y = opts.y;

  this.areaId = Number(opts.areaId || 1);
  this.area = opts.area;
};

//让实体继承事件派发器
util.inherits(Entity, EventEmitter);

/**
 * Expose 'Entity' constructor
 */

module.exports = Entity;

/**
 * Get entityId
 *
 * @return {Number}
 * @api public
 */

Entity.prototype.getEntityId = function() {
  return this.entityId;
};

/**
 * Get state
 *
 * @return {Object}
 * @api public
 */

Entity.prototype.getState = function() {
  return {x: this.x, y: this.y};
};

/**
 * Set positon of this entityId
 *
 * @param {Number} x
 * @param {Number} y
 * @api public
 */

Entity.prototype.setPosition = function(x, y) {
  this.x = x;
  this.y = y;
};


