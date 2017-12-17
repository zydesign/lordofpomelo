/**
 * Module dependencies
 */
var pomelo = require('pomelo');
var util = require('util');
var utils = require('../../util/utils');
var dataApi = require('../../util/dataApi');
var formula = require('../../consts/formula');
var consts = require('../../consts/consts');
var Entity = require('./entity');
var fightskill = require('./../fightskill');
var logger = require('pomelo-logger').getLogger(__filename);

var Character = function(opts) {
  Entity.call(this, opts);
  this.orientation = opts.orientation;
  this.target = null;
  this.attackers = {};

  // the entity who hate me
  // I would notify my enemies to forget me when I disapear or die
  this.enemies = {};

  // the entity I hate
  // I would set my target as the entity that I hate most
  this.haters = {};

  this.died = false;
  this.hp = opts.hp;           //血量值
  this.mp = opts.mp;           //魔法值
  this.maxHp = opts.maxHp;    //血量最大值
  this.maxMp = opts.maxMp;    //魔法最大值    
  this.level = opts.level;      //等级
  this.experience = opts.experience;    //经验值
  this.attackValue = opts.attackValue;  //攻击值
  this.defenceValue = opts.defenceValue;  //防御值
  this.totalAttackValue = opts.totalAttackValue || 0;     //总攻击值
  this.totalDefenceValue = opts.totalDefenceValue || 0;   //总防御值
  this.hitRate = opts.hitRate;      //攻击率（命中率）
  this.dodgeRate = opts.dodgeRate;  //闪避率
  this.walkSpeed = opts.walkSpeed;  //移动速度
  this.attackSpeed = opts.attackSpeed;  //攻击速度
  this.isMoving = false;  

  this.attackParam = 1;
  this.defenceParam = 1;
  this.equipmentParam = 1;
  this.buffs = [];     //拥有的buff
  this.curSkill = 1;  //default normal attack  //当前技能
  this.characterData = dataApi.character.findById(this.kindId);  //角色数据
  this.fightSkills = {};   //战斗技能
};

util.inherits(Character, Entity);

/**
 * Expose 'Character' constructor.
 */
module.exports = Character;


/**
 * Add skills to the fightSkills.
 * 增加技能到技能数组
 * @param {Array} fightSkills
 * @api public
 */
Character.prototype.addFightSkills = function(fightSkills) {
  for (var i = 0; i < fightSkills.length; i++) {
    var skill = fightskill.create(fightSkills[i]);
    this.fightSkills[skill.skillId] = skill;
  }
};

/**
 * Get fight skill data
 * 获取技能数据
 * @api public
 */
Character.prototype.getFightSkillData = function(){
  var data = [];
  for(var key in this.fightSkills){
    var fs = {
      id : Number(key),
      level : this.fightSkills[key].level
    };

    data.push(fs);
  }

  return data;
};

/**
 * Set target of this Character.
 * 添加角色选中的目标
 * @param {Number} targetId entityId of the target
 * @api public
 */
Character.prototype.setTarget = function(targetId) {
  this.target = targetId;
};

/**
 * Check the target.
 * 判断是否已有选中目标
 * @api public
 */
Character.prototype.hasTarget = function() {
  return !!this.target;
};

/**
 * Clear the target.
 * 取消选中目标
 * @api public
 */
Character.prototype.clearTarget = function() {
  this.target = null;
};

/**
 * Reset the hp.
 * 重置血量，比如升级了，血量最大值增加了，就要重置血量
 * @param {Number} maxHp
 * @api public
 */
Character.prototype.resetHp = function(maxHp) {
  this.maxHp = maxHp;
  this.hp = this.maxHp;
  if (!!this.updateTeamMemberInfo) {
    this.updateTeamMemberInfo();
  }
};

/**
 * Recover the hp.
 * 加血
 * @param {Number} hpValue
 * @api public
 */
Character.prototype.recoverHp = function(hpValue) {
  if(this.hp >= this.maxHp) {
    return;
  }

  var hp = this.hp + hpValue;
  if(hp > this.maxHp) {
    this.hp = this.maxHp;
  } else {
    this.hp = hp;
  }
};

/**
 * Reset the mp.
 * 重置魔法值，比如升级了，魔法最大值增加了，就要重置魔法值
 * @param {Number} maxMp
 * @api public
 */
Character.prototype.resetMp = function(maxMp) {
  this.maxMp = maxMp;
  this.mp = this.maxMp;
};

/**
 * Recover the mp.
 * 加蓝
 * @param {Number} mpValue
 * @api public
 */
Character.prototype.recoverMp = function(mpValue) {
  if(this.mp >= this.maxMp) {
    return;
  }

  var mp = this.mp + mpValue;
  if(mp > this.maxMp) {
    this.mp = this.maxMp;
  } else {
    this.mp = mp;
  }
};

/**
 * Move to the destination of (x, y).
 * the map will calculate path by startPosition(startX, startY), endPosition(endX, endY) and cache
 * if the path exist, it will emit the event 'move', or return false and loggerWarn
 * 角色移动
 *地图计算路径起点、终点及缓存，如果路径存在，则发射'move'事件
 * @param {Number} targetX
 * @param {Number} targetY
 * @param {Boolean} useCache
 * @api public
 */
Character.prototype.move = function(targetX, targetY, useCache, cb) {
  useCache = useCache || false;

  if(useCache){
    var paths = this.area.map.findPath(this.x, this.y, targetX, targetY, useCache);

    if(!!paths){
      this.emit('move', {character: this, paths: paths});
      utils.invokeCallback(cb, null, true);
    }else{
      logger.warn('No path exist! {x: %j, y: %j} , target: {x: %j, y: %j} ', this.x, this.y, targetX, targetY);
      utils.invokeCallback(cb, 'find path error', false);
    }
  }else{
    var closure = this;
    pomelo.app.rpc.path.pathFindingRemote.findPath(null, {areaId: this.areaId, start:{x:this.x, y:this.y}, end:{x:targetX, y: targetY}}, function(err, paths){
      if(!!paths){
        closure.emit('move', {character: closure, paths: paths});
        utils.invokeCallback(cb, null, true);
      }else{
        logger.warn('Remote find path failed! No path exist! {x: %j, y: %j} , target: {x: %j, y: %j} ', closure.x, closure.y, targetX, targetY);
        utils.invokeCallback(cb, 'find path error', false);
      }
    });
  }
};

/**
 * attack the target.
 *
 * @param {Character} target
 * @param {Number} skillId
 * @return {Object}
 */
//攻击函数。player类、mob类继承了character类，能直接调用该函数，ai大脑触发攻击行为时调用-----------------------
Character.prototype.attack = function(target, skillId) {
  if (this.confused) {
    return {result: consts.AttackResult.ATTACKER_CONFUSED};
  }

  //You cann't attack a died character!
  if (target.died){
    return {result: consts.AttackResult.KILLED};
  }

  var skill = this.fightSkills[skillId];
  this.setTarget(target.entityId);

  // set up the relationship between attacker and attackee
  this.addEnemy(target.entityId);

  var result = skill.use(this, target);
  this.emit('attack', {
    attacker : this,
    target: target,
    skillId: skillId,
    result: result
  });

  return result;
};

/**
 * Take hit and get damage.
 *
 * @param {Character} attacker
 * @param {Number} damage
 * @api public
 */
Character.prototype.hit = function(attacker, damage) {
  this.increaseHateFor(attacker.entityId);
  this.reduceHp(damage);
};

/**
 * Reduce hp.
 *
 * @param {Number} damageValue
 * @api public
 */
Character.prototype.reduceHp = function(damageValue) {
  this.hp -= damageValue;
  if (this.hp <= 0) {
    this.died = true;
    this.afterDied();
  }
  if (!!this.updateTeamMemberInfo) {
    this.updateTeamMemberInfo();
  }
};

/**
 * Reduce mp.
 *
 * @param {Number} mp
 * @api public
 */
Character.prototype.reduceMp = function(mp) {
  this.mp -= mp;
  if (this.mp <= 0) {
    this.mp = 0;
  }
};

/**
 * Get attackValue.
 *
 * @return {Number}
 * @api private
 */
Character.prototype.getAttackValue = function() {
  return this.attackValue * this.attackParam;
};

/**
 * Get defenceValue.
 *
 * @return {Number}
 * @api private
 */
Character.prototype.getDefenceValue = function() {
  return this.defenceValue * this.defenceParam;
};

/**
 * Get total attackValue.
 *
 * @return {Number}
 * @api public
 */
Character.prototype.getTotalAttack = function() {
  return this.totalAttackValue;
};

/**
 * Get total defenceValue.
 *
 * @return {Number}
 * @api public
 */
Character.prototype.getTotalDefence = function() {
  return this.totalDefenceValue;
};

/**
 * Add buff to buffs.
 *
 * @param {Buff} buff
 * @api public
 */
Character.prototype.addBuff = function(buff) {
  this.buffs[buff.type] = buff;
};

/**
 * Remove buff from buffs.
 *
 * @param {Buff} buff
 * @api public
 */
Character.prototype.removeBuff = function(buff) {
  delete this.buffs[buff.type];
};

/**
 * Add callback to each enemy.
 *
 * @param {Function} callback(enemyId)
 * @api public
 */
Character.prototype.forEachEnemy = function(callback) {
  var enemy;
  for(var enemyId in this.enemies) {
    enemy = this.area.getEntity(enemyId);
    if(!enemy) {
      delete this.enemies[enemyId];
      continue;
    }
    callback(enemy);
  }
};

/**
 * Add enemy to enemies.
 *
 * @param {Number} entityId of enemy
 * @api public
 */
Character.prototype.addEnemy = function(enemyId) {
  this.enemies[enemyId] = 1;
};

/**
 * Forget the enemy.
 *
 * @param {Number} entityId
 * @api public
 */
Character.prototype.forgetEnemy = function(entityId) {
  delete this.enemies[entityId];
};

Character.prototype.forgetHater = function(){};

Character.prototype.forEachHater = function(){};

Character.prototype.increaseHateFor = function(){};

Character.prototype.getMostHater = function(){};

Character.prototype.clearHaters = function() {
  this.haters = {};
};
