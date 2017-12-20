var util = require('util');
var Entity = require('./entity/entity');
var EntityType = require('../consts/consts').EntityType;
var Persistent = require('./persistent');
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Initialize a new 'Bag' with the given 'opts'
 * Bag inherits Persistent
 *
 * @param {Object} opts
 * @api public
 */

//背包是存储道具实体的管理器，player执行“拾取”函数的时候，执行背包的addItem函数
var Bag = function(opts) {
  Persistent.call(this, opts);
  this.itemCount = opts.itemCount || 20;  //背包道具栏数量
  this.items = opts.items || {};  //items储存的是道具intem的id和type，key是从1开始的，不是0,是对应index
};

util.inherits(Bag, Persistent);

module.exports = Bag;

//从背包获取第index位置的道具
Bag.prototype.get = function(index) {
  return this.items[index];
};

//获取背包数据：背包id，道具数量，道具数据组（不是道具实体组）
Bag.prototype.getData = function() {
  var data = {};

  data.id = this.id;
  data.itemCount = this.itemCount;

  data.items = [];
  //key从1开始
  for(var key in this.items){
    var item = {
      key : Number(key),
      id : this.items[key].id,
      type : this.items[key].type
    };
    data.items.push(item);
  }

  return data;
};

/**
 * add item
 *
 * @param {obj} item {id: 123, type: 'item'}
 * @return {number}
 * @api public
 */
//ai大脑player执行拾取函数pickItem（e）时，执行这个背包添加道具函数，商城购买道具也会执行该函数，然后道具储存位置index-------------------增 
Bag.prototype.addItem = function(item) {
  var index = -1;

  //条件有一个成立，就返回index
  if (!item || !item.id || !item.type || !item.type.match(/item|equipment/)) {
    return index;
  }

  for (var i = 1; i <= this.itemCount; i ++) {
    //如果某个道具栏为空，该道具栏填充道具，标签标记道具的位置，跳出遍历
    if (!this.items[i]) {
      this.items[i] = {id: item.id, type: item.type};
      index = i;
      break;
    }
  }

  //如果标签>0，执行背包储存函数，发射save事件，同步数据到数据库
  if (index > 0) {
    this.save();
  }

  //返回储存的位置（第一格为1，第二个为2，以此类推...）
  return index;
};


/**
 * remove item
 *
 * @param {number} index
 * @return {Boolean}
 * @api public
 */
//背包删除道具，删除第index栏的道具，如果删除成功，发送数据储存数据库，并返回true-----------------------------------------删
Bag.prototype.removeItem = function(index) {
  var status = false;
  if (this.items[index]) {
    delete this.items[index];
    this.save();
    status = true;
  }

  return status;
};

//Check out item by id and type
//背包查找道具，通过道具的id和类型查找，返回的是道具栏的index位置----------------------------------------------------------查
Bag.prototype.checkItem = function(id, type) {
  var result = null, i, item;
  for (i in this.items) {
    item = this.items[i];
    if (item.id == id && item.type === type) {
      result = i;
      break;
    }
  }

  return result;
};

//Get all the items
//获取背包所有道具信息
Bag.prototype.all = function() {
  return this.items;
};
