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

/**
 * Add action for area
 * @param action {Object} The action need to add
 * @return {Boolean}
 */
Timer.prototype.addAction = function(action) {
  return this.area.actionManager.addAction(action);
};

/**
 * Abort action for area
 * @param type {Number} The type of the action
 * @param id {Id} The id of the action
 */
Timer.prototype.abortAction = function(type, id) {
  return this.area.actionManager.abortAction(type, id);
};

/**
 * Abort all action for a given id in area
 * @param id {Number}
 */
Timer.prototype.abortAllAction = function(id) {
  this.area.actionManager.abortAllAction(id);
};

/**
 * Enter AI for given entity
 * @param entityId {Number} entityId
 */
Timer.prototype.enterAI = function(entityId) {
  var area = this.area;

  area.patrolManager.removeCharacter(entityId);
  this.abortAction('move', entityId);
  if(!!area.entities[entityId]) {
    area.aiManager.addCharacters([area.entities[entityId]]);
  }
};

/**
 * Enter patrol for given entity
 * @param entityId {Number}
 */
Timer.prototype.patrol = function(entityId) {
  var area = this.area;

  area.aiManager.removeCharacter(entityId);

  if(!!area.entities[entityId]) {
    area.patrolManager.addCharacters([{character: area.entities[entityId], path: area.entities[entityId].path}]);
  }
};

/**
 * Update object for aoi
 * @param obj {Object} Given object need to update.
 * @param oldPos {Object} Old position.
 * @param newPos {Object} New position.
 * @return {Boolean} If the update success.
 */
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
Timer.prototype.updateWatcher = function(watcher, oldPos, newPos, oldRange, newRange) {
  return this.area.aoi.updateWatcher(watcher, oldPos, newPos, oldRange, newRange);
};
