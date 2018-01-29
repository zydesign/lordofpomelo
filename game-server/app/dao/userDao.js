var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var dataApi = require('../util/dataApi');
var Player = require('../domain/entity/player');
var User = require('../domain/user');
var consts = require('../consts/consts');
var equipmentsDao = require('./equipmentsDao');
var bagDao = require('./bagDao');
var fightskillDao = require('./fightskillDao');
var taskDao = require('./taskDao');
var async = require('async');
var utils = require('../util/utils');
var consts = require('../consts/consts');

//用户数据库传输。（PS：增insert、删delete、改update 返回对象； 查select 返回数组，cb需要res[0]提取对象）
var userDao = module.exports;

/**
 * Get user data by username.
 * 通过用户名获取用户信息
 * @param {String} username
 * @param {String} passwd
 * @param {function} cb
 */
//通过用户名username，获取用户信息。-------------------------------------------------------------【通过username获取user用户信息】
userDao.getUserInfo = function (username, passwd, cb) {
	var sql = 'select * from User where name = ?';
	var args = [username];

	pomelo.app.get('dbclient').query(sql,args,function(err, res) {
		if(err !== null) {
				utils.invokeCallback(cb, err, null);
		} else {
			var userId = 0;
			if (!!res && res.length === 1) {
				var rs = res[0];
				userId = rs.id;
				rs.uid = rs.id;
				utils.invokeCallback(cb,null, rs);    //如果有数据，返回res[0]
			} else {
				utils.invokeCallback(cb, null, {uid:0, username: username});  //如果没数据，uid设置为0
			}
		}
	});
};

/**
 * Get an user's all players by userId
 * @param {Number} uid User Id.
 * @param {function} cb Callback function.
 */
//通过uid获取玩家数据组--------------------------------------------------------------------【通过uid获取players玩家数据组】
userDao.getPlayersByUid = function(uid, cb){
	var sql = 'select * from Player where userId = ?';
	var args = [uid];

	pomelo.app.get('dbclient').query(sql,args,function(err, res) {
		if(err) {
			utils.invokeCallback(cb, err.message, null);
			return;
		}

		//如果返回数组为空数组，cb为[]
		if(!res || res.length <= 0) {
			utils.invokeCallback(cb, null, []);
			return;
		} else {
		//如果返回结果有玩家数据，cb为数据库返回的res
			utils.invokeCallback(cb, null, res);
		}
	});
};

/**
 * Get an user's all players by playerId
 * 通过playerId获取单条角色信息
 * @param {Number} playerId
 * @param {function} cb Callback function.
 */
//通过playerId获取玩家数据，返回cb是玩家实体-------------------------------------------------------【通过playerId获取player实体】
userDao.getPlayer = function(playerId, cb){
	var sql = 'select * from Player where id = ?';
	var args = [playerId];

	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
			utils.invokeCallback(cb, err.message, null);
			//如果数据库返回空数组，cb为[]
		} else if (!res || res.length <= 0){
			utils.invokeCallback(cb,null,[]);
			return;
		} else{
			//如果数据库返回有玩家数据，cb为res[0]
			utils.invokeCallback(cb,null, new Player(res[0]));
		}
	});
};

/**
 * get by Name
 * 通过角色名字获取单条角色信息
 * @param {String} name Player name
 * @param {function} cb Callback function
 */
//通过角色名name获取玩家数据-------------------------------------------------------------------------【通过角色名获取player实体】
userDao.getPlayerByName = function(name, cb){
	var sql = 'select * from Player where name = ?';
	var args = [name];

	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if (err !== null){
			utils.invokeCallback(cb, err.message, null);
			//如果数据库返回空数组，cb为null
		} else if (!res || res.length <= 0){
			utils.invokeCallback(cb, null, null);
		} else{
			//如果数据库返回有玩家信息，cb为res[0]
			utils.invokeCallback(cb,null, new Player(res[0]));
		}
	});
};

/**
 * Get all the information of a player, include equipments, bag, skills, tasks.
 * 通过角色id获取该角色的信息，包括角色信息、装备、背包、技能、任务。
 * @param {String} playerId
 * @param {function} cb
 */

//获取玩家所有数据-------------------------------------------------------------------------------【通过playerId获取PlayerAllInfo】
userDao.getPlayerAllInfo = function (playerId, cb) {
	//并行执行，各个函数的结果传给最后的results数组中
	async.parallel([
		function(callback){
			userDao.getPlayer(playerId, function(err, player) {
				if(!!err || !player) {
					logger.error('Get user for userDao failed! ' + err.stack);
				}
				callback(err,player);  //得到player实体
			});
		},
		function(callback) {
			equipmentsDao.getEquipmentsByPlayerId(playerId, function(err, equipments) {
				if(!!err || !equipments) {
					logger.error('Get equipments for eqipmentDao failed! ' + err.stack);
				}
				callback(err,equipments);  //得到装备数据equipments
			});
		},
		function(callback) {
			bagDao.getBagByPlayerId(playerId, function(err, bag) {
				if(!!err || !bag) {
					logger.error('Get bag for bagDao failed! ' + err.stack);
				}
				callback(err,bag);  //得到背包信息bag
			});
		},
		function(callback) {
			fightskillDao.getFightSkillsByPlayerId(playerId, function(err, fightSkills) {
				if(!!err || !fightSkills){
					logger.error('Get skills for skillDao failed! ' + err.stack);
				}
				callback(err, fightSkills);  //得到战斗技能信息fightSkills
			});
		},
		function(callback){
			taskDao.getCurTasksByPlayId(playerId, function(err, tasks) {
				if(!!err) {
					logger.error('Get task for taskDao failed!');
				}
				callback(err, tasks);    //得到任务信息tasks
			});
		}
	], 
	function(err, results) {   //背包、装备、技能、任务，都存入玩家数据player中
		var player = results[0];
		var equipments = results[1];
		var bag = results[2];
		var fightSkills = results[3];
		var tasks = results[4];
		player.bag = bag;
		player.setEquipments(equipments);
		player.addFightSkills(fightSkills);
		player.curTasks = tasks || {};
		
		if (!!err){
			utils.invokeCallback(cb,err);
		}else{
			utils.invokeCallback(cb,null,player);   //最后的cb传送处理过的 player数据
		}
	});
};

/**
 * Get userInfo by username
 * 通过用户名获取单条user信息
 * @param {String} username
 * @param {function} cb
 */
//通过用户名获取用户数据，cb生成user实例----------------------------------------------------------------【通过username获取user实例】
userDao.getUserByName = function (username, cb){
	var sql = 'select * from User where name = ?';
	var args = [username];
	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
			utils.invokeCallback(cb, err.message, null);
		} else {
			if (!!res && res.length === 1) {
				var rs = res[0];       //从数据组[user]中获取对象user数据
				//生成user实例
				var user = new User({id: rs.id, name: rs.name, password: rs.password, from: rs.from});
				utils.invokeCallback(cb, null, user);
			} else {
				utils.invokeCallback(cb, ' user not exist ', null);
			}
		}
	});
};

/**
 * get user infomation by userId
 * 通过uid获取单条user用户信息
 * @param {String} uid UserId
 * @param {function} cb Callback function
 */
//通过uid获取user实例------------------------------------------------------------------------------------【通过uid获取user实例】
userDao.getUserById = function (uid, cb){
	var sql = 'select * from User where id = ?';
	var args = [uid];
	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
			utils.invokeCallback(cb,err.message, null);
			return;
		}

		//如果数据库返回数组有值，cb为生成User实例
		if (!!res && res.length > 0) {
			utils.invokeCallback(cb, null, new User(res[0]));
		} else {
		//如果数据库返回空数组，cb为null
			utils.invokeCallback(cb, ' user not exist ', null);
		}
	});
};

/**
 * delete user by username
 * 通过用户名删除用户信息，返回true或fasle
 * @param {String} username
 * @param {function} cb Call back function.
 */
// 删除指定username的user数据，删除成功true，删除失败false-----------------------------------------------【通过username删除user数据】
userDao.deleteByName = function (username, cb){
	var sql = 'delete from	User where name = ?';
	var args = [username];
	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
				utils.invokeCallback(cb,err.message, null);
		} else {
			//如果删除成功，数据库返回被删除对象，cb为true
			if (!!res && res.affectedRows>0) {
				utils.invokeCallback(cb,null,true);
			} else {
			//如果删除失败，数据库返回null，cb为false
				utils.invokeCallback(cb,null,false);
			}
		}
	});
};

/**
 * Create a new user
 * 通过用户名和密码创建新user到数据库，并返回该user
 * @param (String) username
 * @param {String} password
 * @param {String} from Register source
 * @param {function} cb Call back function.
 */

//先从数据库生成user数据，然后通过返回的数据生成user实例-------------------------------------------------------【生成user实例】
//（如果没有user表，会自动生成表，第一个用户id为1）
//在user表中，插入一条数据，id自增
userDao.createUser = function (username, password, from, cb){
	var sql = 'insert into User (name,password,`from`,loginCount,lastLoginTime) values(?,?,?,?,?)';
	var loginTime = Date.now();
	var args = [username, password, from || '', 1, loginTime];
	pomelo.app.get('dbclient').insert(sql, args, function(err,res){
		if(err !== null){
			utils.invokeCallback(cb, {code: err.number, msg: err.message}, null);
		} else {
			//通过数据库返回对象，生成user实例
			var user = new User({id: res.insertId, name: username, password: password, loginCount: 1, lastLoginTime:loginTime});
			utils.invokeCallback(cb, null, user);
		}
	});
};

/**
 * Create a new player
 * 通过uid、玩家角色名、角色id（roleId）创建新角色到数据库，并返回该角色信息
 * @param {String} uid User id.
 * @param {String} name Player's name in the game.
 * @param {Number} roleId Player's roleId, decide which kind of player to create.
 * @param {function} cb Callback function
 */

//先数据库生成player数据，然后通过返回的数据对象生成player实体----------------------------------------------------【生成player实体】
//（如果没有player表，会自动生成表，第一个角色id为1）
userDao.createPlayer = function (uid, name, roleId,cb){
	var sql = 'insert into Player (userId, kindId, kindName, name, country, rank, level, experience, attackValue, defenceValue, hitRate, dodgeRate, walkSpeed, attackSpeed, hp, mp, maxHp, maxMp, areaId, x, y, skillPoint) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
	//var role = dataApi.role.findById(roleId);
	var character = dataApi.character.findById(roleId);                                //角色数据（目前表中没有玩家的）
  var role = {name: character.englishName, career: 'warrior', country: 1, gender: 'male'}  //角色信息
	var born = consts.BornPlace;                                                       //出生地
	var x = born.x + Math.floor(Math.random()*born.width);                             //生成出生点
	var y = born.y + Math.floor(Math.random()*born.height);
	var areaId = consts.PLAYER.initAreaId;                                             //角色出生场景id
	//role.country = 1;
	var args = [uid, roleId, character.englishName, name, 1, 1, 1, 0, character.attackValue, character.defenceValue, character.hitRate, character.dodgeRate, character.walkSpeed, character.attackSpeed, character.hp, character.mp, character.hp, character.mp, areaId, x, y, 1];

	pomelo.app.get('dbclient').insert(sql, args, function(err,res){
		if(err !== null){
			logger.error('create player failed! ' + err.message);
			logger.error(err);
			utils.invokeCallback(cb,err.message, null);
		} else {
			//生成player实体
			var player = new Player({
				id: res.insertId,
				userId: uid,
				kindId: roleId,
				kindName: role.name,
				areaId: 1,
				roleName: name,
				rank: 1,
				level: 1,
				experience: 0,
				attackValue: character.attackValue,
				defenceValue: character.defenceValue,
				skillPoint: 1,
				hitRate: character.hitRate,
				dodgeRate: character.dodgeRate,
				walkSpeed: character.walkSpeed,
				attackSpeed: character.attackSpeed,
				equipments: {},
				bag: null
			});
			utils.invokeCallback(cb,null,player);
		}
	});
};

/**
 * Update a player
 * 更新玩家信息（坐标、血量、阵营、攻击、防御、攻速等），并返回true或fasle
 * @param {Object} player The player need to update, all the propties will be update.
 * @param {function} cb Callback function.
 */

//通过playerid，更新player数据。更新成功返回true，更新失败返回false-------------------------------------------【更新指定playerId的player数据】
userDao.updatePlayer = function (player, cb){
	var sql = 'update Player set x = ? ,y = ? , hp = ?, mp = ? , maxHp = ?, maxMp = ?, country = ?, rank = ?, level = ?, experience = ?, areaId = ?, attackValue = ?, defenceValue = ?, walkSpeed = ?, attackSpeed = ? , skillPoint = ? where id = ?';
	var args = [player.x, player.y, player.hp, player.mp, player.maxHp, player.maxMp, player.country, player.rank, player.level, player.experience, player.areaId, player.attackValue, player.defenceValue, player.walkSpeed, player.attackSpeed, player.skillPoint, player.id];

	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
			utils.invokeCallback(cb,err.message, null);
		} else {
			//如果更新成功，数据库返回数据对象，cb为true
			if (!!res && res.affectedRows>0) {
				utils.invokeCallback(cb,null,true);
			} else {
			//如果更新失败，数据库返回null，cb为false
				logger.error('update player failed!');
				utils.invokeCallback(cb,null,false);
			}
		}
	});
};

/**
 * Delete player
 * 删除角色，返回true或fasle
 * @param {Number} playerId
 * @param {function} cb Callback function.
 */

//删除指定playerId的player数据，删除成功返回true，删除失败返回false
userDao.deletePlayer = function (playerId, cb){
	var sql = 'delete from	Player where id = ?';
	var args = [playerId];
	pomelo.app.get('dbclient').query(sql,args,function(err, res){
		if(err !== null){
			utils.invokeCallback(cb,err.message, null);
		} else {
			//如果数据库返回player对象，cb为true
			if (!!res && res.affectedRows>0) {
				utils.invokeCallback(cb,null,true);
			} else {
			//如果数据库返回null，cb为false
				utils.invokeCallback(cb,null,false);
			}
		}
	});
};
