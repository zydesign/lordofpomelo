/**
 * Module dependencies  //战斗技能
 */
 var util = require('util');
 var dataApi = require('../util/dataApi');
 var formula = require('../consts/formula');
 var consts = require('../consts/consts');
 var buff = require('./buff');
 var Persistent = require('./persistent');
 var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Action of attack, attacker consume mp while target reduce.
 *
 * @param {Character} attacker
 * @param {Character} target
 * @param {Object} skill
 * @return {Object}
 * @api public
 */

//技能攻击。（攻击类技能use方法调用该函数）
var attack = function(attacker, target, skill) {
	//不能攻击自己
	if (attacker.entityId === target.entityId) {
		return {result: consts.AttackResult.ERROR};
	}
	//If missed
	//miss率=攻击者命中率*（1-目标闪避率/100）/100   ？
//	var missRate = attacker.hitRate * (1 - target.dodgeRag/100) / 100;
//	if(Math.random() < missRate){
//			return {result: consts.AttackResult.MISS, damage: 0, mpUse: skill.skillData.mp};
//	}

	//技能伤害值
	var damageValue = formula.calDamage(attacker, target, skill);   //伤害公式
	//执行目标受攻击函数，目标HP值减少
	target.hit(attacker, damageValue);
	//攻击者扣除MP
	attacker.reduceMp(skill.skillData.mp);
	//攻击者实体和目标实体都同步数据库
	if (!!target.save) {
		target.save();
	}
	if (!!attacker.save) {
		attacker.save();
	}

	//If normal attack, use attack speed
	//计算技能冷却时间
	if(skill.skillId == 1){
		skill.coolDownTime = Date.now() + Number(skill.skillData.cooltime/attacker.attackSpeed*1000);
	}else{
		skill.coolDownTime = Date.now() + Number(skill.skillData.cooltime)*1000;
	}

	//如果目标死亡，获取掉落的道具。返回杀死代码，伤害值，MP消耗，道具
	if (target.died) {
		//执行攻击者刷怪后，目标掉落道具 
		var items = attacker.afterKill(target);
		return {result: consts.AttackResult.KILLED, damage: damageValue, mpUse: skill.skillData.mp, items: items};
	} else{
	//如果技能攻击未致其死亡，返回攻击成功，伤害值，MP消耗	
		return {result: consts.AttackResult.SUCCESS, damage: damageValue, mpUse: skill.skillData.mp};
	}
};

/**
 * Add buff to Character, attacker or target
 */
//加buff技能，返回成功验证码（buff类技能use方法调用该函数）
var addBuff = function(attacker, target, buff) {
	//如果加buff的目标是自己，而且自己没有死
	if (buff.target === 'attacker' && !attacker.died) {
		buff.use(attacker);
		//如果加buff的目标是别人，而且该目标没有死
	} else if (buff.target === 'target' && !target.died) {
		buff.use(target);
	}
	return {result: consts.AttackResult.SUCCESS};
};

/**
 * Initialize a new 'FightSkill' with the given 'opts'.
 *
 * @param {Object} opts
 * @api public
 *
 */
//战斗技能基类，继承Persistent，所以带save发射事件
var FightSkill = function(opts) {
	Persistent.call(this, opts);
	this.skillId = opts.skillId;     //技能id
	this.level = opts.level;         //技能等级
	this.playerId = opts.playerId;   //玩家id
	this.skillData = dataApi.fightskill.findById(this.skillId);   //技能表单获取技能数据
	this.name = this.skillData.name;   //技能名称
	this.coolDownTime = 0;             //技能冷却时间
};

util.inherits(FightSkill, Persistent);


/**
 * Check out fightskill for attacker.
 *
 * @param {Character} attacker
 * @param {Character} target
 * @return {Object}  NOT_IN_RANGE, NOT_COOLDOWN, NO_ENOUGH_MP
 */

//战斗技能的判定
FightSkill.prototype.judge = function(attacker, target) {
	//如果不在施放范围内使用技能，返回不满足放技能的结果
	if (!formula.inRange(attacker, target, this.skillData.distance)){
		return {result: consts.AttackResult.NOT_IN_RANGE, distance: this.skillData.distance};
	}
	//如果冷却时间未到，返回没冷却结果
	if (this.coolDownTime > Date.now()) {
		return {result: consts.AttackResult.NOT_COOLDOWN};
	}
	//这个条件有问题？？？应该是attacker.mp<this.skillData.mp
	if (this.mp < this.mp) {
		return {result: consts.AttackResult.NO_ENOUGH_MP};
	}
	return {result: consts.AttackResult.SUCCESS};
};


//Get upgradePlayerLevel
//还不明白这是算什么的？
FightSkill.prototype.getUpgradePlayerLevel = function(){
	var upgradePlayerLevel = this.skillData.upgradePlayerLevel;
	return (this.level-1)*upgradePlayerLevel + this.skillData.playerLevel;
};

//Get attackParam
FightSkill.prototype.getAttackParam = function(){
	var value = this.skillData.attackParam*1 + (this.level-1)*this.skillData.upgradeParam;
	return value;
};

//攻击技能类。继承战斗技能
var AttackSkill = function(opts) {
	FightSkill.call(this, opts);
};
util.inherits(AttackSkill, FightSkill);

// Attack
//攻击技能的使用方法
AttackSkill.prototype.use = function(attacker, target) {
	var judgeResult = this.judge(attacker, target);
	//如果技能判定结果不是成功，则返回该判定结果
	if (judgeResult.result !== consts.AttackResult.SUCCESS){
		return judgeResult;
	}
	//如果判定成功，执行攻击attack函数
	return attack(attacker, target, this);
};

//buff技能类。继承战斗技能
var BuffSkill = function(opts) {
	FightSkill.call(this, opts);
	this.buff = opts.buff;
};

util.inherits(BuffSkill, FightSkill);


//buff技能的使用方法
BuffSkill.prototype.use = function(attacker, target) {
	return addBuff(attacker, target, this.buff);
};

// both attack and buff
//攻击buff类。继承战斗技能
var AttackBuffSkill = function(opts) {
	FightSkill.call(this, opts);
	this.attackParam = opts.attackParam;
	this.buff = opts.buff;
};
util.inherits(AttackBuffSkill, FightSkill);

//攻击buff的使用方法
AttackBuffSkill.prototype.use = function(attacker, target) {
	var attackResult = attack(attacker, target, this);
	return attackResult;
};

// like BuffSkill, excep init on startup, and timeout is 0
//被动技能类。继承buff技能
var PassiveSkill = function(opts) {
	BuffSkill.call(this, opts);
};

util.inherits(PassiveSkill, BuffSkill);

//普通攻击类。继承攻击技能
var CommonAttackSkill = function(opts) {
	AttackSkill.call(this, opts);
};

util.inherits(CommonAttackSkill, AttackSkill);

/**
 * Create skill
 *
 * @param {Object}
 * @api public
 */
//创建技能，通过参数技能的type属性，实例对应类型的技能
//（Player.learnSkill函数，玩家学习技能执行该函数，生成实例）
//参数skill：{skillId: skillId, level: 1, playerId: this.id, type:'attack'}
var create = function(skill) {
	var curBuff = buff.create(skill);  //生成buff实例
	skill.buff = curBuff;              //然后将buff实例添加到参数skill里
	
	         //技能类型为attack
	if (skill.type === 'attack'){
		return new AttackSkill(skill);
		//技能类型为buff
	} else if (skill.type === 'buff'){
		return new BuffSkill(skill);
		//技能类型为attackBuff
	} else if (skill.type === 'attackBuff'){
		return new AttackBuffSkill(skill);
		//技能类型为被动passive
	} else if (skill.type === 'passive') {
		return new PassiveSkill(skill);
	}
	throw new Error('error skill type in create skill: ' + skill);
};

 module.exports.create = create;                      //生成技能实例（Player.learnSkill函数，玩家学习技能执行该函数，生成实例）
 module.exports.FightSkill = FightSkill;
 module.exports.AttackSkill = AttackSkill;            //攻击技能  工厂函数（未实例）
 module.exports.BuffSkill = BuffSkill;                //buff技能 工厂函数（未实例）
 module.exports.PassiveSkill = PassiveSkill;          //被动技能  工厂函数（未实例）
 module.exports.AttackBuffSkill = AttackBuffSkill;    //攻击buff 工厂函数 （未实例）
