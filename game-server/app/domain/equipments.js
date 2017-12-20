/**
 * Module dependencies
 */

//
var util = require('util');
var Entity = require('./entity/entity');
var EntityType = require('../consts/consts').EntityType;
var Persistent = require('./persistent');
var Underscore = require('underscore');

/**
 * Initialize a new 'Equipments' with the given 'opts'.
 * Equipments inherits Persistent 
 *
 * @param {Object} opts
 * @api public
 */
//角色穿戴的装备，这一份看空空西游的
var Equipments = function(opts) {
	Persistent.call(this, opts);
  this.playerId = opts.playerId;
  this.weapon = opts.weapon || 0;
  this.armor = opts.armor || 0;
  this.helmet = opts.helmet || 0;
  this.necklace = opts.necklace || 0;
  this.ring = opts.ring || 0;
  this.belt = opts.belt || 0;
  this.shoes = opts.shoes || 0;
  this.legguard = opts.legguard || 0;
  this.amulet = opts.amulet || 0;
};

util.inherits(Equipments, Persistent);

//字典
var dict = {
  '武器': 'weapon',
  '项链': 'necklace',
  '头盔': 'helmet',
  '护甲': 'armor' ,
  '腰带': 'belt',
  '护腿': 'legguard',
  '护符': 'amulet',
  '鞋': 'shoes',
  '戒指': 'ring'
};

//转换类型，返回装备类型type
var convertType = function (type) {
//test用于检测字符串是否匹配某个模式，[\u4e00-\u9fa5]匹配中文，这里意思就是检测type是否为中文，如果是中文，获取它的英文标签
  if (/[\u4e00-\u9fa5]/.test(type)) {
    type = dict[type];
  } else {
	  //如果检测到type不是中文，则type转为小写英文标签。【toLowerCase() 方法用于把字符串转换为小写】
    type = type.toLowerCase();
  }

  return type;
};

//Get equipment by type
//获取装备部位 
Equipments.prototype.get = function(type) {
  return this[convertType(type)];
};

//Equip equipment by type and id
//某类型部位装备某id的装备，并同步数据库
Equipments.prototype.equip = function(type, id) {
  this[convertType(type)] = id;
  this.save();
};

//Unequip equipment by type
//某类型部位装备归零，并同步到数据库
Equipments.prototype.unEquip = function(type) {
  this[convertType(type)] = 0;
  this.save();
};

//装备清单，Underscore下划线模块，给dict的值前面加上下划线
var EquipList = Underscore.values(dict);
//判断是否着装了某装备
Equipments.prototype.isEquipment = function(strEquip) {
  return Underscore.contains(EquipList, strEquip);
};

/**
 * Expose 'Equipments' constructor.
 */
module.exports = Equipments;

