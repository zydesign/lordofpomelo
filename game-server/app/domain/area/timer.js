var messageService = require('./../messageService');
var EntityType = require('../../consts/consts').EntityType;
var logger = require('pomelo-logger').getLogger(__filename);

var Timer = function(opts){
  this.area = opts.area;
  this.interval = opts.interval||100;
};

module.exports = Timer;

//实例area场景，立刻执行该run服务
Timer.prototype.run = function () {
  //开启定时器：间隔100毫秒执行一次tick函数
  this.interval = setInterval(this.tick.bind(this), this.interval);
};

Timer.prototype.close = function () {
  clearInterval(this.interval);
};


//tick函数将会在开启场景时立刻定时执行
Timer.prototype.tick = function() {
  var area = this.area;

  //Update mob zones  定时刷新怪物
  for(var key in area.zones){
    //执行怪物空间的update时，就会间隔5秒生成限制数量的一个怪物实体，调用area.addEntity（e）函数生成实体
    area.zones[key].update();
  }

  //Update all the items  定时刷新物品
  for(var id in area.items) {
    var item = area.entities[id];
    item.update();

    //如果物品消失，场景频道广播删除物品消息
    if(item.died) {
      area.channel.pushMessage('onRemoveEntities', {entities: [id]});
      area.removeEntity(id);
    }
  }

  //run all the action 定时更新所有动作
  area.actionManager.update();

  //定时更新ai
  area.aiManager.update();

  //定时更新巡逻
  area.patrolManager.update();
};

/** 动作管理部分---------------------------------------------------通常是area场景服务器调用
 * Add action for area
 * @param action {Object} The action need to add
 * @return {Boolean}
 */

//增加一个动作到动作管理器（characterEvent注册移动事件时调用了该函数，）
Timer.prototype.addAction = function(action) {
  return this.area.actionManager.addAction(action);
};

/**
 * Abort action for area
 * @param type {Number} The type of the action
 * @param id {Id} The id of the action
 */
//停止一个动作组中的某个动作
Timer.prototype.abortAction = function(type, id) {
  return this.area.actionManager.abortAction(type, id);
};

/**
 * Abort all action for a given id in area
 * @param id {Number}
 */
//停止动作组的所有动作
Timer.prototype.abortAllAction = function(id) {
  this.area.actionManager.abortAllAction(id);
};

/** ai管理部分------------------------------------------------------- 
 * Enter AI for given entity
 * @param entityId {Number} entityId
 */
//给一个实体增加ai，----------------------------------------------------------------------------------0
//（1.怪物处于巡逻状态时，characterEvent注册攻击事件，怪物受到攻击时调用了这个函数）
//（2.怪物处于巡逻状态时，aoi事件监听玩家进入怪物视野，怪物通过Mob.increaseHateFor锁定目标，从巡逻系统转为ai系统从而攻击玩家 ）
Timer.prototype.enterAI = function(entityId) {
  var area = this.area;

  //先从巡逻管理中移除，并停止这个动作，然后ai管理器中增加这个角色
  area.patrolManager.removeCharacter(entityId);
  this.abortAction('move', entityId);
  if(!!area.entities[entityId]) {
    //添加实体AI，只需提供实体参数，这里添加角色会实例一个大脑brain，而aiManager会给该大脑brain创建黑板参数blackboard
    area.aiManager.addCharacters([area.entities[entityId]]);
  }
};

/** 巡逻管理部分--------------------------------------------------------- 
 * Enter patrol for given entity
 * @param entityId {Number}
 */
//给实体加入到巡逻系统。先从ai管理中移除，并判断这个实体必须在场景中（该函数由ai大脑tiger实例巡逻动作patrol的doAction调用）.............
Timer.prototype.patrol = function(entityId) {
  var area = this.area;

  //退出ai系统
  area.aiManager.removeCharacter(entityId);

  //加入巡逻系统
  if(!!area.entities[entityId]) {
    area.patrolManager.addCharacters([{character: area.entities[entityId], path: area.entities[entityId].path}]);
  }
};

/** aoi管理部分----------------------------------------------------------- 
 * Update object for aoi
 * @param obj {Object} Given object need to update.
 * @param oldPos {Object} Old position.
 * @param newPos {Object} New position.
 * @return {Boolean} If the update success.
 */
// 更新对象位置（action动作的move.update执行移动后，会执行该函数更新对象在场景area中的位置）.................
Timer.prototype.updateObject = function(obj, oldPos, newPos) {
  return this.area.aoi.updateObject(obj, oldPos, newPos);
};

/**
 * Get all the watchers in aoi for given position.
 * @param pos {Object} Given position.
 * @param types {Array} The watchers types.
 * @param ignoreList {Array} The ignore watchers' list.
 * @return {Array} The qualified watchers id list.
 */
// 获取观察者uid（这个主要是给观察者广播自己位置的）
Timer.prototype.getWatcherUids = function(pos, types, ignoreList) {
  var area = this.area;

  var watchers = area.aoi.getWatchers(pos, types);
  var result = [];
  if(!!watchers && !! watchers[EntityType.PLAYER]) {
    var pWatchers = watchers[EntityType.PLAYER];
    for(var entityId in pWatchers) {
      var player = area.getEntity(entityId);
      if(!!player && !! player.userId && (!ignoreList || !ignoreList[player.userId])) {
        result.push({uid:player.userId, sid : player.serverId});
      }
    }
  }

  return result;
};

/**
 * Get watchers by given position and types, without ignore list.
 * @param pos {Object} Given position.
 * @param types {Array} Given watcher types.
 * @return {Array} Watchers find by given parameters.
 */
//获取观察者
Timer.prototype.getWatchers = function(pos, types) {
  return this.area.aoi.getWatchers(pos, types);
};

/**
 * Update given watcher.
 * @param watcher {Object} The watcher need to update.
 * @param oldPos {Object} The old position of the watcher.
 * @param newPos {Ojbect} The new position of the watcher.
 * @param oldRange {Number} The old range of the watcher.
 * @param newRange {Number} The new range of the watcher.
 * @return Boolean If the update is success.
 */
//更新观察者 （action动作的move.update执行移动后，会执行该函数更新观察者）.................
Timer.prototype.updateWatcher = function(watcher, oldPos, newPos, oldRange, newRange) {
  return this.area.aoi.updateWatcher(watcher, oldPos, newPos, oldRange, newRange);
};
