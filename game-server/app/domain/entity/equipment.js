/**
 * Module dependencies
 */
var util = require('util');
var Entity = require('./entity');
var EntityType = require('../../consts/consts').EntityType;

/**
 * Initialize a new 'Equipment' with the given 'opts'.
 * Equipment inherits Entity
 *
 * @class ChannelService
 * @constructor
 * @param {Object} opts
 * @api public
 */

//装备实体类（所有属性都可以从表获取）
var Equipment = function(opts) {
  Entity.call(this, opts);
  this.type = EntityType.EQUIPMENT;                //实体类型
  this.name = opts.name;                           //装备名称
  this.desc = opts.desc;                           //装备描述（攻击力、防御力）
  this.englishDesc = opts.englishDesc;             //装备英文描述
  this.kind = opts.kind;                           //装备类型（穿戴部位:武器、护手、护腿等）
  this.attackValue = Number(opts.attackValue);     //攻击值
  this.defenceValue = Number(opts.defenceValue);   //防御值
  this.price = opts.price;                         //出售价格
  this.color = opts.color;                         //颜色
  this.heroLevel = opts.heroLevel;                 //穿戴等级
  this.imgId = opts.imgId;                         //图标id
  this.playerId = opts.playerId;                   //穿戴的玩家id

  this.lifetime = 30000;                           //掉落的生命时间
  this.time = Date.now();                          //每次刷新的时间
  this.died = false;                               //掉落是否消失
};

util.inherits(Equipment, Entity);

/**
 * Expose 'Equipment' constructor.
 */
module.exports = Equipment;

/**
 * Equipment refresh every 'lifetime' millisecond
 *更新装备掉落的倒计时，
 * @api public
 */
Equipment.prototype.update = function(){
  var next = Date.now();
  this.lifetime -= (next - this.time);

  this.time = next;
  if(this.lifetime <= 0) {
    this.died = true;
  }
};

//装备掉落数据，位置，玩家保护等
Equipment.prototype.toJSON = function() {
  return {
    entityId: this.entityId,
    kindId: this.kindId,
    x: this.x,
    y: this.y,
    playerId: this.playerId,
    type: this.type
  };
};
