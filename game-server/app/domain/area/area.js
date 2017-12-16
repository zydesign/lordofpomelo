var dataApi = require('../../util/dataApi');
var MobZone = require('./../map/mobzone');
var NPC = require('./../entity/npc');
var pomelo = require('pomelo');
var ai = require('../../ai/ai');
var patrol = require('../../patrol/patrol');
var ActionManager = require('./../action/actionManager');
var aoiManager = require('pomelo-aoi');
var eventManager = require('./../event/eventManager');
var aoiEventManager = require('./../aoi/aoiEventManager');
var EntityType = require('../../consts/consts').EntityType;
var utils = require('../../util/utils');
var Timer = require('./timer');
var logger = require('pomelo-logger').getLogger(__filename);
var channelUtil = require('../../util/channelUtil');

/**
 * Init areas
 * @param {Object} opts
 * @api public
 */
//场景类，主要把一些小类实例到属性中，为之提供参数opt，并调用这些小类的原型函数进行各种操作。
//场景入口为scene，参数opt为一份场景数据

var Instance = function(opts){
  this.areaId = opts.id;
  this.type = opts.type;
  this.map = opts.map;  //参数提供的地图实例。opt.map这个属性是scene另外添加的

  //The map from player to entity
  this.players = {};  //储存角色的实体id组
  this.users = {};    //储存角色id组
  this.entities = {};   //这里储存角色、怪物、道具等实体，是所有类型的实体
  this.zones = {};
  this.items = {};   //储存道具和装备的实体id组
  this.channel = null;

  this.playerNum = 0;
  this.emptyTime = Date.now();
  //Init AOI 通过opts参数配置，建立地图灯塔阵为aoi,aoi就是对对象id及观察者id的管理
  this.aoi = aoiManager.getService(opts);  //aoi工厂实例

  this.aiManager = ai.createManager({area:this});  //ai工厂实例
  this.patrolManager = patrol.createManager({area:this});  //patrol创建一个巡逻管理器
  this.actionManager = new ActionManager();  //动作工厂实例

  //定时器工厂实例
  this.timer = new Timer({
    area : this,
    interval : 100
  });

  //一旦实例了工厂函数，里面执行各种服务
  this.start();
};

module.exports = Instance;

/**
 * @api public
 */
// 启动场景
Instance.prototype.start = function() {
  //监听aoi事件,包括对象的add/remove/updat,观察者的updateWatcher
  aoiEventManager.addEvent(this, this.aoi.aoi);  //开启aoi事件监听服务

  //Init mob zones
  this.initMobZones(this.map.getMobZones());  //初始化化怪物区块
  this.initNPCs();  //初始化NPC

  this.aiManager.start(); //开启ai服务,允许aiManager添加、删除、更新大脑实例
  this.timer.run(); //开启定时器
};


// 关闭定时器
Instance.prototype.close = function(){
  this.timer.close();
};

/**
 * Init npcs
 * @api private
 */
// 初始化NPC，场景开启立即运行，添加npcs实体组........................................
Instance.prototype.initNPCs = function() {
  var npcs = this.map.getNPCs();

  for(var i = 0; i < npcs.length; i++) {
    var data = npcs[i];

    data.kindId = data.id;
    var npcInfo = dataApi.npc.findById(data.kindId);
    data.kindName = npcInfo.name;
    data.englishName = npcInfo.englishName;
    data.kindType = npcInfo.kindType;
    data.orientation = data.orientation;
    data.areaId = this.id;

    this.addEntity(new NPC(data));
  }
};

Instance.prototype.getChannel = function() {
  if(!this.channel){
    var channelName = channelUtil.getAreaChannelName(this.areaId);
    utils.myPrint('channelName = ', channelName);
    this.channel = pomelo.app.get('channelService').getChannel(channelName, true);
  }

  utils.myPrint('this.channel = ', this.channel);
  return this.channel;
};

/**
 * Init all zones in area
 * @api private
 */
//初始化怪物空间，场景开启立即运行，添加怪物空间组..........................................
Instance.prototype.initMobZones = function(mobZones) {
  //遍历map的怪物对象组
  for(var i = 0; i < mobZones.length; i++) {
    var opts = mobZones[i]; //单个怪物对象数据
    opts.area = this;
    var zone = new MobZone(opts);  //生成单个类型的怪物空间
    this.zones[zone.zoneId] = zone;  //添加到怪物空间组
  }
};

/**
 * Add entity to area
 * @param {Object} e Entity to add to the area.
 */

//场景添加实体，加入实体组，加入事件管理器，加入场景频道channel，加入ai大脑，加入aoi观察者等等，添加成功会返回true=========
Instance.prototype.addEntity = function(e) {
  var entities = this.entities;
  var players = this.players;
  var users = this.users;

  //判断实体是否存在
  if(!e || !e.entityId) {
    return false;
  }

  //判断是否已经添加过该角色
  if(!!players[e.id]) {
    logger.error('add player twice! player : %j', e);
    return false;
  }

  
  //Set area and areaId
  //给参数加入场景属性
  e.area = this;

  //加入实体组
  entities[e.entityId] = e;
  //加入事件
  eventManager.addEvent(e);

  //如果实体类型为玩家，加入频道channel，加入ai大脑，加入aoi观察者，加入角色id组
  if(e.type === EntityType.PLAYER) {
    this.getChannel().add(e.userId, e.serverId);
    this.aiManager.addCharacters([e]);

    this.aoi.addWatcher({id: e.entityId, type: e.type}, {x : e.x, y: e.y}, e.range);
    players[e.id] = e.entityId;   //该角色的实体id
    users[e.userId] = e.id;   //对应用户的角色id（player.id）

    this.playerNum++;   //记录场景有多少玩家
    utils.myPrint('e = ', JSON.stringify(e));
    utils.myPrint('e.teamId = ', JSON.stringify(e.teamId));
    utils.myPrint('e.isCaptain = ', JSON.stringify(e.isCaptain));
    
   //如果实体类型为怪物
  }else if(e.type === EntityType.MOB) {
    this.aiManager.addCharacters([e]);

    this.aoi.addWatcher({id: e.entityId, type: e.type}, {x : e.x, y: e.y}, e.range);
    
    //如果实体类型为道具
  }else if(e.type === EntityType.ITEM) {
    this.items[e.entityId] = e.entityId;
    
    //如果实体类型为装备
  }else if(e.type === EntityType.EQUIPMENT) {
    this.items[e.entityId] = e.entityId;
  }

  //无论实体什么类型，要加入实体对象的aoi，以便观察者知道其位置
  this.aoi.addObject({id:e.entityId, type:e.type}, {x: e.x, y: e.y});
  return true;
};

/**
 * Remove Entity form area
 * @param {Number} entityId The entityId to remove
 * @return {boolean} remove result
 */

//场景中删除实体，包括从频道中移除，从ai大脑组中移除，从巡逻组中移除，从aoi对象组中移除，停止该实体的动作等，删除成功返回true========
Instance.prototype.removeEntity = function(entityId) {
  var zones = this.zones;
  var entities = this.entities;
  var players = this.players;
  var users = this.users;
  var items = this.items;

  var e = entities[entityId];
  if(!e) return true;

  //If the entity belong to a subzone, remove it
  if(!!zones[e.zoneId]) {
    zones[e.zoneId].remove(entityId);
  }

  //If the entity is a player, remove it
  if(e.type === 'player') {
    this.getChannel().leave(e.userId, pomelo.app.getServerId());
    this.aiManager.removeCharacter(e.entityId);
    this.patrolManager.removeCharacter(e.entityId);
    this.aoi.removeObject({id:e.entityId, type: e.type}, {x: e.x, y: e.y});
    this.actionManager.abortAllAction(entityId);

    e.forEachEnemy(function(enemy) {
      enemy.forgetHater(e.entityId);
    });

    e.forEachHater(function(hater) {
      hater.forgetEnemy(e.entityId);
    });

    this.aoi.removeWatcher(e, {x : e.x, y: e.y}, e.range);
    delete players[e.id];
    delete users[e.userId];

    this.playerNum--;

    if(this.playerNum === 0){
      this.emptyTime = Date.now();
    }
    delete entities[entityId];
  }else if(e.type === 'mob') {
    this.aiManager.removeCharacter(e.entityId);
    this.patrolManager.removeCharacter(e.entityId);
    this.aoi.removeObject({id: e.entityId, type: e.type}, {x: e.x, y: e.y});
    this.actionManager.abortAllAction(entityId);

    e.forEachEnemy(function(enemy) {
      enemy.forgetHater(e.entityId);
    });

    e.forEachHater(function(hater) {
      hater.forgetEnemy(e.entityId);
    });

    this.aoi.removeWatcher(e, {x : e.x, y: e.y}, e.range);
    delete entities[entityId];
  }else if(e.type === EntityType.ITEM || e.type === EntityType.EQUIPMENT) {
    delete items[entityId];
    this.aoi.removeObject({id: e.entityId, type: e.type}, {x: e.x, y: e.y});
    delete entities[entityId];
  }

  // this.aoi.removeObject(e, {x: e.x, y: e.y});
  // delete entities[entityId];
  return true;
};

/**
 * Get entity from area
 * @param {Number} entityId.
 */
//从场景中获取实体
Instance.prototype.getEntity = function(entityId) {
  var entity = this.entities[entityId];
  if (!entity) {
    return null;
  }
  return entity;
};

/**
 * Get entities by given id list
 * @param {Array} The given entities' list.
 * @return {Map} The entities
 */
//从场景中获取一批实体，返回对象
Instance.prototype.getEntities = function(ids) {
  var result = {};

  result.length = 0;  //记录实体的数量，也就是ids的数量
  for(var i = 0; i < ids.length; i++) {
    var entity = this.entities[ids[i]];
    if(!!entity) {
      //不同类型放到不同数组中
      if(!result[entity.type]){
        result[entity.type] = [];
      }

      result[entity.type].push(entity);
      result.length++;
    }
  }

  return result;
};

//获取一批角色，返回数组
Instance.prototype.getAllPlayers = function() {
  var _players = []; 
  for(var id in this.players) {
    _players.push(this.entities[this.players[id]]);
  }

  return _players;
};

//获取所有实体，返回场景实体组
Instance.prototype.getAllEntities = function() {
  return this.entities;
};

//获取单个角色，返回该角色的实体，如果没有返回null
Instance.prototype.getPlayer = function(playerId) {
  //先获取该角色的实体id
  var entityId = this.players[playerId];

  //然后从实体组中获取对应的实体
  if(!!entityId) {
    return this.entities[entityId];
  }

  return null;
};

//通过角色id，删除场景中的单个角色实体
Instance.prototype.removePlayer = function(playerId) {
  var entityId = this.players[playerId];

  if(!!entityId) {
    this.removeEntity(entityId);
  }
};

//通过uid，删除场景中的单个角色实体，这里要用户组中多删一个角色id
Instance.prototype.removePlayerByUid = function(uid){
  var users = this.users;
  var playerId = users[uid];

  if(!!playerId){
    delete users[uid];
    this.removePlayer(playerId);
  }
};

/**
 * Get area entities for given postion and range.
 * @param {Object} pos Given position, like {10,20}.
 * @param {Number} range The range of the view, is the circle radius.
 */
//获取一个灯塔范围内的实体
Instance.prototype.getAreaInfo = function(pos, range) {
  var ids = this.aoi.getIdsByPos(pos, range);
  return this.getEntities(ids);
};

/**
 * Get entities from area by given pos, types and range.
 * @param {Object} pos Given position, like {10,20}.
 * @param {Array} types The types of the object need to find.
 * @param {Number} range The range of the view, is the circle radius.
 */
//通过位置、类型、、范围，获取一批实体，不同类型为一个数组，返回一个result对象
Instance.prototype.getEntitiesByPos = function(pos, types, range) {
  var entities = this.entities;
  var idsMap = this.aoi.getIdsByRange(pos, range, types);
  var result = {};
  for(var type in idsMap) {
    if(type === 'npc' || type === 'item') continue;
    if(!result[type]) {
      result[type] = [];
    }
    for(var i = 0; i < idsMap[type].length; i++) {
      var id = idsMap[type][i];
      if(!!entities[id]) {
        result[type].push(entities[id]);
      }else{
        logger.error('AOI data error ! type : %j, id : %j', type, id);
      }
    }
  }
  return result;
};

//判断场景是否有玩家
Instance.prototype.isEmpty = function(){
  return this.playerNum === 0;
};
