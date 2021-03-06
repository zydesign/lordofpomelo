/**
 * Module dependencies
 */

var util = require('util');
var formula = require('../../consts/formula');
var EntityType = require('../../consts/consts').EntityType;
var Character = require('./character');
var dataApi = require('../../util/dataApi');
var Item = require('./item');
var Equipment = require('./equipment');
var fightSkill = require('./../fightskill');
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Initialize a new 'Mob' with the given 'opts'.
 * Mob inherits Character
 *
 * @param {Object} opts
 * @api public
 */
//怪物类。在怪物空间mobzone生成怪物时，实例这个函数
var Mob = function(opts) {
  Character.call(this, opts);
  this.type = EntityType.MOB;
  this.spawningX = opts.x;        //怪物卵坐标
  this.spawningY = opts.y;
  this.level = Number(opts.level);
  this.armorLevel = opts.armorLevel;
  this.weaponLevel = opts.weaponLevel;
  this.zoneId = opts.zoneId;

  // override the character hp calculate value
  //根据怪物等级，怪物表基础血量，怪物升级系数，新计算怪物血量
  this.hp = formula.calMobValue(this.characterData.hp, this.level, this.characterData.upgradeParam);
  this.mp = formula.calMobValue(this.characterData.mp, this.level, this.characterData.upgradeParam);
  this.maxHp = this.hp;
  this.maxMp = this.mp;

  //根据怪物等级，怪物表基础攻击防御，怪物升级系数，计算怪物攻击值和防御值
  this.attackValue = formula.calMobValue(this.characterData.attackValue, this.level, this.characterData.upgradeParam);
  this.defenceValue = formula.calMobValue(this.characterData.defenceValue, this.level, this.characterData.upgradeParam);

  //怪物攻击范围
  this.range = this.range||0;    //怪物视野范围，单位瓦片
  //执行初始化怪物技能
  this._initFightSkill();
  //执行设置怪物总攻击和总防御
  this.setTotalAttackAndDefence();
};

util.inherits(Mob, Character);

/**
 * Expose 'Mob' constructor
 */

module.exports = Mob;

/**
 * Init fightSkill.
 *
 * @api private
 */

Mob.prototype._initFightSkill = function() {
  if(!this.fightSkills[this.curSkill]){
    var skill = fightSkill.create({skillId: 1, level: 1, playerId: this.id, type:'attack'});
    this.fightSkills[this.curSkill] = skill;
  }
};

/**
 * Destory mob after mob is died.
 *
 * @api public
 */

Mob.prototype.destroy = function() {
  this.died = true;
  this.haters = {};
  this.clearTarget();
};

/**
 * Check the haters and judge of the entityId hated
 */

Mob.prototype.isHate = function(entityId) {
  return !!this.haters[entityId];
};


/**
 * Increase hate points for the entity.
 * if need be, change the target and enterAI
 *
 * @param {Number} entityId
 * @param {Number} points
 * @api public
 */

//怪物看到玩家进入攻击范围，锁定玩家目标，调用timer.enterAI(entityId)函数从巡逻系统转为ai系统，从而攻击玩家
Mob.prototype.increaseHateFor = function(entityId, points) {
  points = points || 1;
  if(this.haters[entityId]){
    this.haters[entityId] += points;
  }else{
    this.haters[entityId] = points;
  }
  this.target = this.getMostHater();
  this.area.timer.enterAI(this.entityId);
};

//Get the most hater
Mob.prototype.getMostHater = function() {
  var entityId = 0, hate = 0;
  for(var id in this.haters){
    if(this.haters[id] > hate) {
      entityId = id;
      hate = this.haters[id];
    }
  }
  if(entityId <= 0){
    return null;
  }
  // key of map is string type
  return Number(entityId);
};

// Forget the hater
//解除对目标的锁定........................................
Mob.prototype.forgetHater = function(entityId) {
  if(this.haters[entityId]) {
    delete this.haters[entityId];
    this.target = this.getMostHater();
  }
};

/**
 * Add cb to each hater.
 *
 * @param {Function} cb
 * @api public
 */
//遍历自己锁定的目标id组，场景获取对应的实体..............................
Mob.prototype.forEachHater = function(cb) {
  for(var id in this.haters){
    var hater = this.area.getEntity(id);
    if(hater){
      cb(hater);
    } else {
      this.forgetHater(id);
    }
  }
};

//Increase hate for the player who is coming.
//（aoi事件，‘add’监听事件触发时，灯塔点怪物类型的观察者，执行onPlayerAdd函数会执行该函数，看见玩家，锁定目标，timer.enterAI转入ai系统，自动攻击）
Mob.prototype.onPlayerCome = function(entityId) {
  var player = this.area.getEntity(entityId);

  //Only hit a live person
  if(!!player && !player.died){
    this.increaseHateFor(entityId, 1);
    player.addEnemy(this.entityId);
  }
};

/**
 * Drop items down.
 * when a mob is killed, it drops equipments and items down to the player
 *
 * @param {Player} player
 * @api public
 */

//怪物死亡，掉落道具。（战斗技能fightskill攻击怪物致死后，执行Player.afterKill就会调用该函数）
Mob.prototype.dropItems = function(player) {
  var itemCount = Math.floor(Math.random()*2.1);
  var dropItems = [];
  for (var i = 0; i<itemCount; i++) {
    var itemType = Math.floor(Math.random()*10);
    if (itemType >= 4) {
      var item = this._dropItem(player);
      if(!!item){
        dropItems.push(item);
      }
    }else{
      var equipment = this._dropEquipment(player);
      if(!!equipment){
        dropItems.push(equipment);
      }
    }
  }
  return dropItems;
};

//Drop Item down
Mob.prototype._dropItem = function(player) {
  var level = Math.min(this.level, player.level);
  var pos = this.area.map.genPos(this, 200);
  if(!pos){
    logger.warn('Generate position for drop item error!');
    return null;
  }

  var itemDatas = dataApi.item.findSmaller('heroLevel', level);
  var length = itemDatas.length;
  var index = Math.floor(Math.random()*length);
  var itemData = itemDatas[index];
  var dropItem = new Item({
    kindId : itemData.id,
    x : Math.floor(pos.x),
    y : Math.floor(pos.y),
    kindName : itemData.name,
    englishName : itemData.englishName,
    name: itemData.name,
    desc : itemData.desc,
    englishDesc : itemData.englishDesc,
    kind : itemData.kind,
    hp : itemData.hp,
    mp : itemData.mp,
    price : itemData.price,
    playerId: player.id,
    imgId: itemData.imgId,
    heroLevel: itemData.heroLevel
  });
  return dropItem;
};

//Drop Equipment down
Mob.prototype._dropEquipment = function(player) {
  var level = formula.dropItemLv(this.level, player.level);

  var pos = this.area.map.genPos(this, 200);
  if(!pos){
    logger.warn('Generate position for drop equipment error!');
    return null;
  }

  var equipments = this.getEquipmentsByLevel(level);
  var index = Math.floor(Math.random()*equipments.length);
  var equipment = equipments[index];
  var dropEquipment = new Equipment({
    kindId : equipment.id,
    x : Math.floor(pos.x),
    y : Math.floor(pos.y),
    kindName : equipment.name,
    englishName : equipment.englishName,
    name : equipment.name,
    desc : equipment.desc,
    englishDesc: equipment.englishDesc,
    kind : equipment.kind,
    attackValue : equipment.attackValue,
    defenceValue : equipment.defenceValue,
    price : equipment.price,
    color: equipment.color,
    imgId: equipment.imgId,
    playerId: player.id,
    heroLevel: equipment.heroLevel
  });
  return dropEquipment;
};

Mob.prototype.getEquipmentsByLevel = function(level){
  while(level > 0){
    var equipments = dataApi.equipment.findBy('heroLevel', level);
    if(equipments.length > 0)
      return equipments;
    level--;
  }

  return [];
}

//Reset position
Mob.prototype.resetPosition = function() {
  this.setPosition(this.spawningX, this.spawningY);
};

/**
 * Go back to the spawning position after 'time' millisecond.
 *
 * @param {Number} time
 * @api public
 */

Mob.prototype.returnToSpawningPosition = function(time) {
  var delay = time || 4000;

  this.clearTarget();

  setTimeout(function() {
    this.resetPosition();
    this.move(this.x,this.y);
  },delay);
};

//Emit the event 'died'
//发射死亡事件。（角色HP小于0时，Character.reduceHp执行该函数）
Mob.prototype.afterDied = function() {
  this.emit('died', this);
};

//Emit the event 'killed'
// 怪物杀死玩家后，发射killed事件（fightskill的attack攻击到目标死亡了，执行该函数）
Mob.prototype.afterKill = function(target) {
  this.emit('killed', target);
};

Mob.prototype.setTotalAttackAndDefence = function() {
  this.totalAttackValue = this.getAttackValue();
  this.totalDefenceValue = this.getDefenceValue();
};

//Get experience after mob killed
Mob.prototype.getKillExp = function(playerLevel) {
  return formula.calMobExp(this.characterData.baseExp, playerLevel, this.level);
};

/**
 * Get hit from attacker and increase hate for the attacker.
 *
 * @param {Player} attacker
 * @param {Number} damage
 * @api public
 */

Mob.prototype.hit = function(attacker, damage) {
  Character.prototype.hit.call(this, attacker, damage);
  this.increaseHateFor(attacker.entityId, 5);
};

/**
 * Convert the mob information to json.
 *
 * @return {Object}
 * @api public
 */

Mob.prototype.toJSON = function() {
  return {
    id: this.id,
    entityId: this.entityId,
    kindId: this.kindId,
    kindName: this.kindName,
    englishName: this.englishName,
    x: this.x,
    y: this.y,
    hp: this.hp,
    mp: this.mp,
    maxHp: this.maxHp,
    maxMp: this.maxMp,
    type: this.type,
    level: this.level,
    zoneId: this.zoneId,
    walkSpeed: this.walkSpeed
  };
};
