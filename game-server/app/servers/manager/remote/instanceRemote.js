var utils = require('../../../util/utils');
var instanceManager = require('../../../services/instanceManager');
var exp = module.exports;
//管理服务器rpc。
var logger = require('pomelo-logger').getLogger(__filename);

//创建场景副本，绑定到指定服务器id的服务器中，返回{副本服务器id，副本id}
//（服务areaService.changeArea调用该函数）
exp.create = function(params, cb){
  logger.error('create server params : %j', params);
  //通过副本管理服务，生成副本实例，返回{副本服务器id，副本id}
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



