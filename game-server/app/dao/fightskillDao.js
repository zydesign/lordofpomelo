var fightskill = require('../domain/fightskill');
var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var utils = require('../util/utils');

var fightskillDao = module.exports;

/**
 * Add a new fight skill
 *
 * @param {Number} playerId 
 * @param {function} cb 
 */
//在FightSkill表插入一条技能数据，然后cb生成对应的 fightSkill 实例 （Player.learnSkill玩家学习技能调用该函数）
fightskillDao.add = function(skill, cb) {
	var sql = 'insert into FightSkill (playerId, skillId, level, type ) values (?, ?, ?, ?)';
	var args = [skill.playerId, skill.skillId, skill.level, skill.type];

	pomelo.app.get('dbclient').insert(sql, args, function(err, res) {
		if (err) {
			logger.error(err.message);
			utils.invokeCallback(cb, err);
		} else {
			skill.id = res.insertId;
			var fightSkill = fightskill.create(skill);   //创建fightskill 实例
			utils.invokeCallback(cb, null, fightSkill);
		}
	});
};

/**
 * Update fight skill
 * @param val {Object} Update params, contains level and skill id
 */
//通过技能id，更新id的技能数据
fightskillDao.update = function(val, cb) {
	var sql = 'update FightSkill set level = ? where id = ?';
	var args = [val.level, val.id];

	pomelo.app.get('dbclient').query(sql, args, function(err, res) {
		if (err) {
			logger.error('write mysql failed!　' + sql + ' ' + JSON.stringify(val));
		} else {
			logger.info('write mysql success! flash dbok ' + sql + ' ' + JSON.stringify(val));
		}
		utils.invokeCallback(cb, !!err);
	});
};

/**
 * Find fightskills by playerId
 *
 * @param {Number} playerId 
 * @param {function} cb 
 */
//通过playerId获取FightSkill数据组，然后每一条技能数据生成FightSkill 实例，cb为fightSkills 实例组
fightskillDao.getFightSkillsByPlayerId = function(playerId, cb) {
	var sql = 'select * from FightSkill where playerId = ?';
	var args = [playerId];

	pomelo.app.get('dbclient').query(sql, args, function(err, res) {
		if (err) {
			utils.invokeCallback(cb, err);
		} else {
			var fightSkills = [];
			for (var i = 0; i<res.length; i++){
				var result = res[i];
				var fightSkill = fightskill.create({id: result.id, playerId: result.playerId, skillId: result.skillId, level: result.level, type: result.type});
				fightSkills.push(fightSkill);
			}
			utils.invokeCallback(cb, null, fightSkills);
		}
	});
};
