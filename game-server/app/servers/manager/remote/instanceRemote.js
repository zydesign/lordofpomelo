var utils = require('../../../util/utils');
var instanceManager = require('../../../services/instanceManager');
var exp = module.exports;
//副本服务器rpc
var logger = require('pomelo-logger').getLogger(__filename);

//创建副本服务器（服务areaService.changeArea调用该函数）
exp.create = function(params, cb){
  logger.error('create server params : %j', params);
  //通过副本管理服务，生成副本实例
  instanceManager.getInstance(params, function(err, result){
    if(err){
      logger.error('create instance error! args : %j, err : %j', params, err);
      utils.invokeCallback(cb, err);
    }else{
      utils.invokeCallback(cb, null, result);
    }
  });
};

//删除副本，返回被删除的
exp.remove = function(id, cb){
  //通过副本管理服务，删除副本
  instanceManager.remove(id);

  utils.invokeCallback(cb, null, id);
};



