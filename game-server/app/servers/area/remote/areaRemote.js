var utils = require('../../../util/utils');
var instancePool = require('../../../domain/area/instancePool');
var logger = require('pomelo-logger').getLogger(__filename);

//场景副本rpc
var exp = module.exports;

//玩家切换场景，rpc到manager服务器，在生成副本服务器id作为路由，rpc到这里生成副本------------------------------------生成场景副本
// 生成副本（副本管理服务的instanceManager.getInstance调用该函数）
//参数params：{areaId : args.areaId, instanceId : instanceId} 目标场景id和副本id（副本id格式：1_1）
exp.create = function(params, cb){
  var start = Date.now();
  var result = instancePool.create(params);
  var end = Date.now();
  logger.info('create instance use time : %j', end - start);  //打印创建副本使用时间

  utils.invokeCallback(cb, null, result);
};

// 关闭场景副本
exp.close = function(params, cb){
  var id = params.id;
  var result = instancePool.close(id);

  utils.invokeCallback(cb, null, result);
};



