var formula = module.exports;
var logger = require('pomelo-logger').getLogger(__filename);

//公式模块

//技能伤害
formula.calDamage = function(attacker, target, skill) {
	var atk = attacker.getTotalAttack();                 //攻击者的总攻击力
	var def = target.getTotalDefence();                  //目标的总防御力
	var mul = Math.sqrt(Math.abs(atk-def))/5 + 1;        //攻击伤害
	
	mul = atk>def?mul:0.8/mul;
	var defence = 1/Math.pow((target.getTotalDefence()+5)/5, 0.33);
	
	var damage = Math.ceil(attacker.getTotalAttack()*defence*mul*(Math.random()*0.2 + 0.9));
	damage = Math.ceil(skill.getAttackParam() * damage);
	if (damage <= 0) {
		damage = 1;
	}
	if (damage > target.hp) {
		damage = target.hp;
		if(damage == 0){
			logger.error('attack a died mob!!! %j', target);
		}
		
	}
	return Math.round(damage);
};

formula.calMobValue = function(baseValue, level, upgradeParam) {
	baseValue = Number(baseValue);
	var value = Math.round(baseValue +  baseValue * (level - 1) * upgradeParam);
	return value;
};

/**
 * the experience gained by player when kill some mob
 */
//杀怪获得经验值
formula.calMobExp = function(baseExp, playerLevel, mobLevel) {
	var diff = playerLevel - mobLevel;
	var mul = Math.pow(Math.abs(diff),1.5)/6 + 1;
	
	mul = diff < 0?mul:Math.pow(1/mul, 2);
	
	//Experienc add limit
	if(mul > 5){
		mul = 5;
	}
	
	var exp = Math.floor(baseExp * mobLevel * mul);
	if(exp <= 1){
		exp = 1;
	}
	
	return exp;
};

/**
 * Check the distance between origin and target whether less than the range.
 *
 * @param origin {Object} origin entity
 * @param target {Object} target entity
 * @param range {Number} the range of distance
 */
//判断角色与目标的距离是否在限制范围
formula.inRange = function(origin, target, range) {
  var dx = origin.x - target.x;
  var dy = origin.y - target.y;
  return dx * dx + dy * dy <= range * range;
};

formula.distance = function(x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
};

//掉落道具等级
formula.dropItemLv = function(mobLv, heroLv){
	var lv = Math.min(mobLv, heroLv);
	
	var maxLv = Math.min(25, (lv - 1));
	var limit = 4;
	var num = 3;
	var seed = Math.random()*limit;
	
	var dif = Math.floor(maxLv*Math.pow(num,seed)/Math.pow(num, limit));
	
	return lv - dif;	
}

/**
 * convert the date according to format
 * @param {Object} date
 * @param {String} format
 * @param {String} 
 */
//获取时间格式（如：2017年12月222日 下午7:27:16）
formula.timeFormat = function(date) {
	var n = date.getFullYear(); 
	var y = date.getMonth() + 1;
	var r = date.getDate(); 
	var mytime = date.toLocaleTimeString(); 
	var mytimes = n+ "-" + y + "-" + r + " " + mytime;
  return mytimes;
};
