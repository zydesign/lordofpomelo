var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var Bag = require('../domain/bag');
var utils = require('../util/utils');

var bagDao = module.exports;

/**
 * Create Bag
 *
 * @param {Number} playerId Player Id
 * @param {function} cb Call back function
 */
//在bag表插入一条bag数据，然后cb生成bag实例-------------------------------------------------------【插入新bag数据，创建bag实例】
//（connector/handler/roleHandler..createPlayer，创建角色调用该函数创建背包）
bagDao.createBag = function(playerId, cb) {
	var sql = 'insert into Bag (playerId, items, itemCount) values (?, ?, ?)';
	var args = [playerId, '{}', 20];
	
	pomelo.app.get('dbclient').insert(sql, args, function(err, res) {
		if (err) {
			logger.error('create bag for bagDao failed! ' + err.stack);
			utils.invokeCallback(cb, err, null);
		} else {
			var bag = new Bag({id: res.insertId});
			utils.invokeCallback(cb, null, bag);
		}
	});
	
};

/**
 * Find bag by playerId 
 * 
 * @param {Number} playerId Player id.
 * @param {function} cb Call back function.
 */
//通过playerId获取背包数据，然后cb生成bag 实例
bagDao.getBagByPlayerId = function(playerId, cb) {
	var sql = 'select * from Bag where playerId = ?';
	var args = [playerId];

	pomelo.app.get('dbclient').query(sql, args, function(err, res) {
		if (err) {
			logger.error('get bag by playerId for bagDao failed! ' + err.stack);
			utils.invokeCallback(cb, err, null);
		} else {
			if (res && res.length === 1) {
				var result = res[0];
				var bag = new Bag({ id: result.id, itemCount: result.itemCount, items: JSON.parse(result.items) });
				cb(null, bag);
			} else {
				logger.error('bag not exist');
				utils.invokeCallback(cb, new Error(' bag not exist '), null);
			}
		}
	});
};

/**
 * Update bag
 * @param {Object} bag Bag object.
 * @param {function} cb Call back function.
 */
//更新指定bag.id的bag数据
bagDao.update = function(bag, cb) {
	var sql = 'update Bag set items = ? where id = ?';
	var items = bag.items;
	if (typeof items !== 'string') {
		items = JSON.stringify(items);
	}
	
	var args = [items, bag.id];

	pomelo.app.get('dbclient').query(sql, args, function(err, res) {
		if (err) {
			logger.error('write mysql failed!　' + sql + ' ' + JSON.stringify(bag));
		}
		
		utils.invokeCallback(cb, !!err);
	});
};

/**
 * Destroy a bag
 * 
 * @param {number} playerId
 * @param {function} cb
 */
//删除指定playerId的bag数据，cb为被删除的bag数据
bagDao.destroy = function(playerId, cb) {
	var sql = 'delete from Bag where playerId = ?';
	var args = [playerId];

	pomelo.app.dbclinet.query(sql, args, function(err, res) {
		utils.invokeCallback(cb, err, res);
	});
};

