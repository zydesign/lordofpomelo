/**
 * Module dependencies
 */
var util = require('util');
var dataApi = require('../../util/dataApi');
var formula = require('../../consts/formula');
var consts = require('../../consts/consts');
var EntityType = require('../../consts/consts').EntityType;
var TaskType = require('../../consts/consts').TaskType;
var TaskState = require('../../consts/consts').TaskState;
var Character = require('./character');
var fightskillDao = require('../../dao/fightskillDao');
var taskDao = require('../../dao/taskDao');
var fightskill = require('./../fightskill');
var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var utils = require('../../util/utils');
var underscore = require('underscore');

/**
 * Initialize a new 'Player' with the given 'opts'.
 * Player inherits Character
 *
 * @param {Object} opts
 * @api public
 */
var Player = function(opts) {
  Character.call(this, opts);  //player继承character
  this.id = Number(opts.id);   //playerId
  this.type = EntityType.PLAYER;  //角色类型
  this.userId = opts.userId;   //uid
  this.name = opts.name;       //角色名
  this.equipments = opts.equipments;   //角色装备
  this.bag = opts.bag;     //角色背包
  this.skillPoint = opts.skillPoint || 0;    //角色技能点
  var _exp = dataApi.experience.findById(this.level+1);    //角色经验值
  if (!!_exp) {
    this.nextLevelExp = dataApi.experience.findById(this.level+1).exp;   //下一级所需经验
  } else {
    this.nextLevelExp = 999999999;   //如果拿不到角色经验值，下一级所需为极大
  }
  this.roleData = dataApi.role.findById(this.kindId);   //角色数据
  this.curTasks = opts.curTasks;   //角色已接任务（PS：接新任务时会遍历已接任务，使得已接任务都是不同kindId的任务）
  this.range = opts.range || 2;     //角色视野范围，单位瓦片
  // player's team id, default 0(not in any team).
  this.teamId = consts.TEAM.TEAM_ID_NONE;    //团队ID。初始的TEAM_ID_NONE就是没有队伍
  // is the team captain, default false
  this.isCaptain = consts.TEAM.NO;      //是否团队队长。初始不是队长
  // game copy flag
  this.isInTeamInstance = false;   //是否在团队里。初始不在队伍
  this.instanceId = 0;   //场景副本id。初始没有副本

  this.setTotalAttackAndDefence();    //设置总攻击和防御
};

util.inherits(Player, Character);

/**
 * Expose 'Player' constructor.
 */
module.exports = Player;

//emit the event 'died' after it is died
// 发射死亡事件（角色HP小于0时，Character.reduceHp调用该函数）
Player.prototype.afterDied = function() {
  this.emit('died', this);
};

//Add experience add Drop out items after it kills mob
// 杀死怪物后，增加经验和掉落物品（fightskill的attack攻击到目标死亡了，执行该函数）
Player.prototype.afterKill = function(target) {
  var items = null;
  if (target.type === EntityType.MOB) {
    this.addExperience(target.getKillExp(this.level));
    items = target.dropItems(this);
  }

  return items;
};

//Add experience
//杀死怪物获得经验
Player.prototype.addExperience = function(exp) {
  this.experience += exp;
  if (this.experience >= this.nextLevelExp) {
    this.upgrade();
  }
  this.save();
};

/**
 * Upgrade and update the player's state
 * when it upgrades, the state such as hp, mp, defenceValue etc will be update
 * emit the event 'upgrade'
 *
 * @api public
 */
//玩家升级。2个工作：1.执行升级函数更新属性。2.发射'upgrade'升级事件，将更新的玩家属性状态player.strip()推送给客户端
Player.prototype.upgrade = function() {
  while (this.experience >= this.nextLevelExp) {
    //logger.error('player.upgrade ' + this.experience + ' nextLevelExp: ' + this.nextLevelExp);
    this._upgrade();
  }
  this.emit('upgrade');
};

// update team member info
Player.prototype.updateTeamMemberInfo = function() {
  if (this.teamId > consts.TEAM.TEAM_ID_NONE) {
    utils.myPrint('UpdateTeamMemberInfo is running ...');
    var memberInfo = this.toJSON4TeamMember();
    memberInfo.needNotifyElse = true;
    pomelo.app.rpc.manager.teamRemote.updateMemberInfo(null, memberInfo,
      function(err, ret) {
      });
  }
};

//Upgrade, update player's state
//玩家升级类。更新player玩家的属性值，设置攻防总值，更新队伍信息
Player.prototype._upgrade = function() {
  this.level += 1;
  this.maxHp += Math.round(this.characterData.upgradeParam * this.characterData.hp);
  this.maxMp += Math.round(this.characterData.upgradeParam * this.characterData.mp);
  this.hp = this.maxHp;
  this.mp = this.maxMp;
  this.attackValue += Math.round(this.characterData.upgradeParam * this.characterData.attackValue);
  this.defenceValue += Math.round(this.characterData.upgradeParam * this.characterData.defenceValue);
  this.experience -= this.nextLevelExp;
  this.skillPoint += 1;
  this.nextLevelExp = dataApi.experience.findById(this.level+1).exp;
  this.setTotalAttackAndDefence();
  this.updateTeamMemberInfo();
};

//设置总攻击和总防御
Player.prototype.setTotalAttackAndDefence = function() {
  var attack = 0, defence = 0;

  //遍历角色穿戴的装备
  for (var key in this.equipments) {
    if(!this.equipments.isEquipment(key)) {
      continue;
    }
    //获取穿戴装备的数据
    var equip = dataApi.equipment.findById(this.equipments[key]);
    if (!!equip) {
      attack += Number(equip.attackValue);
      defence += Number(equip.defenceValue);
    }
  }

  //logger.error('defence :%j, %j', this.getDefenceValue() , defence);
  //更新总攻击属性、总防御属性
  this.totalAttackValue = this.getAttackValue() + attack;
  this.totalDefenceValue = this.getDefenceValue() + defence;
};

/**
 * Equip equipment.
 *
 * @param {String} kind
 * @param {Number} equipId
 * @api public
 */
//穿戴装备，如果身上指定位置本来没装备，返回背包位置-1；如果有装备，返回脱下装备到背包的位置index
//(场景服务器的equipHandler.equip调用该函数）
//（PS：并不需要返回角色属性给客户端，只需修改角色在服务器的属性方便调用，玩家离线会将属性同步数据库，而客户端根据现有属性去更改，结果跟服务器一致）
Player.prototype.equip = function(kind, equipId) {
  var index = -1;
  var curEqId = this.equipments.get(kind);
  this.equipments.equip(kind, equipId);

  //如果指定类型的装备身上有穿，则放回背包
  if (curEqId > 0) {
    index = this.bag.addItem({id: curEqId, type: 'equipment'});
  }
  this.setTotalAttackAndDefence();

  return index;
};

/**
 * Unequip equipment by kind.
 *
 * @param {Number} kind
 * @api public
 */
//脱掉装备
Player.prototype.unEquip = function(kind) {
  this.equipments.unEquip(kind);
  this.setTotalAttackAndDefence();
};

/**
 * Use Item and update player's state: hp and mp,
 *
 * @param {Number} index
 * @return {Boolean}
 * @api public
 */
//玩家使用道具。（场景服务器的playerHandler.useItem调用该函数）
Player.prototype.useItem = function(index) {
  var item = this.bag.get(index);
  if (!item || item.type !== 'item') {
    return false;
  }
  //通过道具id从表单获取道具数据
  var itm = dataApi.item.findById(item.id);
  if (itm) {
    this.recoverHp(itm.hp);         //回复HP
    this.recoverMp(itm.mp);         //回复MP
    this.updateTeamMemberInfo();    //更新队伍信息
  }
  this.bag.removeItem(index);       //背包删除指定标签道具
  return true;
};

/**
 * Learn a new skill.
 *
 * @param {Number} skillId
 * @param {Function} callback
 * @return {Blooean}
 * @api public
 */
//玩家学习技能。（connector/handler/roleHandler.createPlayer调用该函数）
Player.prototype.learnSkill = function(skillId, callback) {
  //技能id获取技能数据
  var skillData = dataApi.fightskill.findById(skillId);
  //如果玩家等级没达到学习技能等级或战斗技能组已有该技能，返回false
  if (this.level < skillData.playerLevel || !!this.fightSkills[skillId]) {
    return false;
  }
  //生成战斗技能实例
  var fightSkill = fightskill.create({skillId: skillId, level: 1, playerId: this.id, type:'attack'});
  this.fightSkills[skillId] = fightSkill;      //加入战斗技能组
  fightskillDao.add(fightSkill, callback);    //插入新技能到数据库fightSkill表，返回cb是fightSkill 实例
  return true;
};

/**
 * Upgrade the existing skill.
 *
 * @param {Number} skillId
 * @return {Boolean}
 * @api public
 */
//玩家升级技能。（playerHandler.upgradeSkill调用该函数）
Player.prototype.upgradeSkill = function(skillId) {
  var fightSkill = this.fightSkills[skillId];  //是已有技能，所有从技能组获取

  //如果获取不到技能，或者技能点为0，或者不够等级升级，返回false
  if (!fightSkill || this.skillPoint <= 0 || this.level < fightSkill.skillData.playerLevel * 1 + fightSkill.level * 5) {
    return false;
  }
  //满足升级条件，技能等级+1，点数-1，更新到数据库，返回true
  fightSkill.level += 1;   
  this.skillPoint--;
  fightskillDao.update(fightSkill);
  return true;
};

/**
 * Pick item.
 * It exists some results: NOT_IN_RANGE, VANISH, BAG_FULL, SUCCESS
 *
 * @param {Number} entityId
 * @return {Object}
 * @api public
 */
//ai系统的player大脑生成拾取动作时，执行该函数.........................................
Player.prototype.pickItem = function(entityId) {
  var item = this.area.getEntity(entityId);

  var result = {player : this, item : item};

  //如果道具不存在，增加一个道具消失的属性
  if(!item) {
    result.result = consts.Pick.VANISH;
    this.emit('pickItem', result);
    return result;
  }

  // TODO: remove magic pick distance 200
  //不在拾取范围200内，返回值加入拾取距离200属性
  if(!formula.inRange(this, item, 200)) {
    result.distance = 200;
    result.result = consts.Pick.NOT_IN_RANGE;
    return result;
  }

  //可以拾取，背包执行添加道具函数（条件判断里面执行），返回背包储存的标签位置
  var index = this.bag.addItem({id: item.kindId, type: item.type});
  //如果背包标签小于1，说明遍历背包所有道具栏了，背包满没有位置放道具，拾取结果添加背包满属性
  if (index < 1) {
    result.result = consts.Pick.BAG_FULL;
    this.emit('pickItem', result);
    return result;
  }

  //可以拾取，并且道具放回背包，返回结果添加道具存放位置标签，拾取成功属性，发射拾取事件
  result.index = index;
  result.result = consts.Pick.SUCCESS;
  this.emit('pickItem', result);
  return result;
};

// Emit the event 'save'.
//角色发射'save'事件的函数player.save（）.................................................................save
Player.prototype.save = function() {
  this.emit('save');
};

/**
 * Start task.
 * Start task after accept a task, and update the task' state, such as taskState, taskData, startTime
 *
 * @param {Task} task, new task to be implement
 * @api public
 */
//玩家点击接受任务，或任务进阶时，由场景服务器的taskHandler脚本调用该函数，给task添加属性，发射save事件，并同步到数据库
Player.prototype.startTask = function(task) {
  task.taskState = TaskState.NOT_COMPLETED;
  //任务击杀数量清零
  task.taskData = {
    'mobKilled': 0,
    'playerKilled': 0
  };
   //任务的开始时间为当前时间
  task.startTime = formula.timeFormat(new Date());
  //任务进度同步到数据库（/app/dao/taskDao.js的创建新任务createNewTask注册任务的on）
  task.save();
  var id = task.id;   //任务id（数据库的id）
  this.curTasks[id] = task;   //加入到任务组中
};

/**
 * Handover task.
 * Handover task after curTask is completed, and upgrade the tasks' state
 *
 * @param {Array} taskIds
 * @api public
 */

//玩家提交任务
Player.prototype.handOverTask = function(taskIds) {
  var length = taskIds.length;
  //遍历参数提供的任务id组，从player的当前任务组中匹配对应的任务，该任务状态改为“已完成”，同步到数据库
  for (var i = 0; i < length; i++) {
    var id = taskIds[i];
    var task = this.curTasks[id];
    task.taskState = TaskState.COMPLETED;
    task.save();  //发射储存数据库事件，其中save注册位置在/app/dao/taskDao.js
    // delete this.curTasks[id];
  }
};

/**
 * Recover hp if not in fight state
 *
 */
Player.prototype.recover = function(lastTick){
  var time = Date.now();

  if(!this.isRecover){
    this.revocerWaitTime -= 100;
  }

  this.hp += (time - lastTick)/ this.maxHp;
  if(this.hp >= this.maxHp){
    this.hp = this.maxHp;
    this.isRecover = false;
  }
  this.updateTeamMemberInfo();
};

//Complete task and tasks' state.
//玩家击杀怪物或收集道具达到数量时，由executeTask执行该函数，将任务状态改为完成未发送并同步到数据库...........................................
Player.prototype.completeTask = function(taskId) {
  var task = this.curTasks[taskId];
  task.taskState = TaskState.COMPLETED_NOT_DELIVERY;
  task.save();
};

//Convert player' state to json and return
//角色状态信息。（发射save事件，同步角色数据到数据库）（发射'upgrade'升级事件，推送消息给客户端）
Player.prototype.strip = function() {
  return {
    id: this.id,
    entityId: this.entityId,
    name: this.name,
    kindId: this.kindId,
    kindName: this.kindName,
    type: this.type,
    x: Math.floor(this.x),
    y: Math.floor(this.y),
    hp: this.hp,
    mp: this.mp,
    maxHp: this.maxHp,
    maxMp: this.maxMp,
    level: this.level,
    experience: this.experience,
    attackValue: this.attackValue,
    defenceValue: this.defenceValue,
    walkSpeed: this.walkSpeed,
    attackSpeed: this.attackSpeed,
    areaId: this.areaId,
    hitRate: this.hitRate,
    dodgeRate: this.dodgeRate,
    nextLevelExp: this.nextLevelExp,
    skillPoint: this.skillPoint,
    teamId: this.teamId,
    isCaptain: this.isCaptain
  };
};

/**
 * Get the whole information of player, contains tasks, bag, equipments information.
 *
 *	@return {Object}
 *	@api public
 */
//获取玩家信息（playerHandler.enterScene玩家登录场景时执行该函数，获取角色信息、背包信息、装备信息、战斗技能、当前任务）
Player.prototype.getInfo = function() {
  var playerData = this.strip();
  playerData.bag = this.bag.getData();
  playerData.equipments = this.equipments;
  playerData.fightSkills = this.getFightSkillData();
  playerData.curTasks = this._getCurTasksInfo();

  return playerData;
};

//Check out the haters and judge the entity given is hated or not
Player.prototype.isHate = function(entityId) {
  return !!this.haters[entityId];
};

/**
 * Increase hate points for the entity.
 * @param {Number} entityId
 * @param {Number} points
 * @api public
 */
Player.prototype.increaseHateFor = function(entityId, points) {
  points = points || 1;
  if(!!this.haters[entityId]) {
    this.haters[entityId] += points;
  } else {
    this.haters[entityId] = points;
  }
};

//Get the most hater
Player.prototype.getMostHater = function() {
  var entityId = 0, hate = 0;
  for(var id in this.haters) {
    if(this.haters[id] > hate) {
      entityId = id;
      hate = this.haters[id];
    }
  }

  if(entityId <= 0) {
    return null;
  }
  return this.area.getEntity(entityId);
};

// Forget the hater
Player.prototype.forgetHater = function(entityId) {
  if(!!this.haters[entityId]) {
    delete this.haters[entityId];
    if(this.target === entityId) {
      this.target =	null;
    }
  }
};

/**
 * Add cb to each hater.
 *
 * @param {Function} cb
 * @api public
 */
//遍历自己锁定的目标，从场景获取对应的实体
Player.prototype.forEachHater = function(cb) {
  for(var id in this.haters) {
    var hater = this.area.getEntity(id);
    if(hater) {
      cb(hater);
    } else {
      this.forgetHater(id);
    }
  }
};

Player.prototype.setEquipments = function(equipments){
  this.equipments = equipments;
  this.setTotalAttackAndDefence();
};

/**
 * Get part of curTasks information.
 * It aims to be passed to client
 * @return {Object}
 * @api private
 */
//获取player当前任务信息组
Player.prototype._getCurTasksInfo = function() {
  var reTasks = [];
  if (this.curTasks) {
    for(var id in this.curTasks) {
      var task = this.curTasks[id];
      //下划线模块分析任务完成条件
      var cc = underscore.pairs(task.completeCondition)[0];
      reTasks.push({
        acceptTalk: task.acceptTalk,
        workTalk: task.workTalk,
        finishTalk: task.finishTalk,
        item: task.item,
        name: task.name,
        id: task.id,
        exp: task.exp,
        taskData: JSON.stringify(task.taskData),
        taskState: task.taskState,
        completeCondition: JSON.stringify(task.completeCondition)
      });
    }
  }
  return reTasks;
};

/**
 * Parse String to json.
 * It covers object' method
 *
 * @param {String} data
 * @return {Object}
 * @api public
 */
Player.prototype.toJSON = function() {
  return {
    id: this.id,
    entityId: this.entityId,
    name: this.name,
    kindId: this.kindId,
    kindName: this.kindName,
    type: this.type,
    x: this.x,
    y: this.y,
    hp: this.hp,
    mp: this.mp,
    maxHp: this.maxHp,
    maxMp: this.maxMp,
    level: this.level,
    walkSpeed: this.walkSpeed,
    areaId: this.areaId,
    range: this.range,
    teamId: this.teamId,
    isCaptain: this.isCaptain
  };
};

/**
 * Parse String to json for joining a team.
 * 玩家加入的队伍信息
 * @return {Object}
 * @api public
 */
//生成队长队伍信息（area/handler/teamHandler.inviteJoinTeam 队长邀请玩家加入队伍调用该函数。生成队长队伍信息）
Player.prototype.toJSON4Team = function() {
  return {
    id: this.id,
    name: this.name,
    level: this.level,
    teamId: this.teamId
  };
};

/**
 * Parse String to json for team member.
 * 该玩家作为队员的信息
 * @return {Object}
 * @api public
 */
//生成队员信息（playerHandler.enterScene玩家进入场景调用该函数）
Player.prototype.toJSON4TeamMember = function() {
  return {
    playerId: this.id,
    areaId: this.areaId,
    playerData: {
      name: this.name,
      kindId: this.kindId,
      hp: this.hp,
      mp: this.mp,
      maxHp: this.maxHp,
      maxMp: this.maxMp,
      level: this.level,
      teamId: this.teamId,
      isCaptain: this.isCaptain,
      instanceId: this.instanceId // game copy id 副本id
    }
  };
};

// player joins a team
//玩家加入队伍，添加player.teamId属性
Player.prototype.joinTeam = function(teamId) {
  if(!teamId || teamId === consts.TEAM.TEAM_ID_NONE) {
    return false;
  }
  this.teamId = teamId;
  return true;
};

// player leaves the team
//玩家离队。（area/remote/playerRemote.leaveTeam调用该函数）
Player.prototype.leaveTeam = function() {
  if(this.teamId === consts.TEAM.TEAM_ID_NONE) {
    return false;
  }
  //离队就是把this.teamId的值归零
  this.teamId = consts.TEAM.TEAM_ID_NONE;
  return true;
};

// check if player in a team
Player.prototype.isInTeam = function() {
  return (this.teamId !== consts.TEAM.TEAM_ID_NONE);
};

