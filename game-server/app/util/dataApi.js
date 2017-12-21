// require json files
var area = require('../../config/data/area');
var character = require('../../config/data/character');
var equipment = require('../../config/data/equipment');
var experience = require('../../config/data/experience');
var npc = require('../../config/data/npc');
var role = require('../../config/data/role');
var talk = require('../../config/data/talk');
var item = require('../../config/data/item');
var fightskill = require('../../config/data/fightskill');
var task = require('../../config/data/task');
var team = require('../../config/data/team');

/**
 * Data model `new Data()`
 * 通过参数数据json脚本，实例化一个数据对象集合。对象集的key为物品id，对应的value为子物品
 * @param {Array}
 *
 */

//返回结果属性data数据组，去掉了1~2项的描述对象，子对象都是单一数据
var Data = function(data) {
//英文标签项单独存为一个对象	
  var fields = {};   //储存英文标签
  data[1].forEach(function(i, k) {
    fields[i] = k;
  });
//数据数组单独分离为一个数组
  data.splice(0, 2);
//之后创建一个数据对象存储上面的数据，子对象为一份key为英文项目名的数据
  var result = {}, item;   
  data.forEach(function(k) {
    item = mapData(fields, k);
    result[item.id] = item;
  });

  this.data = result;   //
};

/**
 * map the array data to object
 * 将数组数据item映射到对象
 * @param {Object}
 * @param {Array}
 * @return {Object} result
 * @api private
 */
var mapData = function(fields, item) {
  var obj = {};
  for (var k in fields) {
    obj[k] = item[fields[k]];
  }
  return obj;
};

/**
 * find items by attribute
 * 通过子物品key及对应的值查找物品，返回物品数组，数组值为子物品对象
 * @param {String} attribute name
 * @param {String|Number} the value of the attribute
 * @return {Array} result
 * @api public
 */
Data.prototype.findBy = function(attr, value) {
  var result = [];
  var i, item;
  //遍历所以物品，并通过自定的属性和值匹配自定的物品
  for (i in this.data) {
    item = this.data[i];
    if (item[attr] == value) {
      result.push(item);
    }
  }
  return result;
};
  //求大于等于某个属性值的物品数组
Data.prototype.findBigger = function(attr, value) {
  var result = [];
  value = Number(value);
  var i, item;
  for (i in this.data) {
    item = this.data[i];
    if (Number(item[attr]) >= value) {
      result.push(item);
    }
  }
  return result;
};
  //求小于等于某个属性值的物品数组
Data.prototype.findSmaller = function(attr, value) {
  var result = [];
  value = Number(value);
  var i, item;
  for (i in this.data) {
    item = this.data[i];
    if (Number(item[attr]) <= value) {
      result.push(item);
    }
  }
  return result;
};

/**
 * find item by id
 * 通过物品id查找物品，返回物品对象
 * @param id
 * @return {Obj}
 * @api public
 */
Data.prototype.findById = function(id) {
  return this.data[id];
};

/**
 * find all item
 * 返回全部物品对象
 * @return {array}
 * @api public
 */
Data.prototype.all = function() {
  return this.data;
};

//直接代入了参数，直接调用就获取了数据。比如：dataApi.area就是场景地图数据
module.exports = {
  area: new Data(area),
  character: new Data(character),
  equipment: new Data(equipment),
  experience: new Data(experience),
  npc: new Data(npc),
  role: new Data(role),
  talk: new Data(talk),
  item: new Data(item),
  fightskill: new Data(fightskill),
	task: new Data(task),
	team: new Data(team)
};
