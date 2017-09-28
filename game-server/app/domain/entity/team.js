/**
 * Module dependencies
 */
var consts = require('../../consts/consts');
var pomelo = require('pomelo');
var utils = require('../../util/utils');
var channelUtil = require('../../util/channelUtil');
var Event = require('../../consts/consts').Event;

// max member num in a team
// 队伍成员最大数
var MAX_MEMBER_NUM = 3;
///////////////////////////////////////////////////////
//通过队伍id来实例化这个工厂函数
function Team(teamId){
  this.teamId = 0;
  this.teamName = consts.TEAM.DEFAULT_NAME; //默认队伍名为空
  this.playerNum = 0;  //玩家数量
  this.captainId = 0;  //队长id
  this.playerDataArray = new Array(MAX_MEMBER_NUM); //3个队员的数组
  // team channel, push msg within the team
  this.channel = null;  //该队伍频道

  var _this = this;
  
  // constructor
  //初始化就是给工厂函数属性填数值
  var init = function()	{
    //参数写入this.teamId
    _this.teamId = teamId;
    var arr = _this.playerDataArray;
    //给队伍配置，空队员信息
    for(var i = 0; i < arr.length; ++i) {
      arr[i] = {playerId: consts.TEAM.PLAYER_ID_NONE, areaId: consts.TEAM.AREA_ID_NONE,
        userId: consts.TEAM.USER_ID_NONE, serverId: consts.TEAM.SERVER_ID_NONE,
        backendServerId: consts.TEAM.SERVER_ID_NONE, playerData: consts.TEAM.PLAYER_INFO_NONE};
    }
    _this.createChannel();
  };

  init();
}

//创建队伍频道
Team.prototype.createChannel = function() {
  if(this.channel) {
    return this.channel;
  }
  var channelName = channelUtil.getTeamChannelName(this.teamId);
  this.channel = pomelo.app.get('channelService').getChannel(channelName, true);
  if(this.channel) {
    return this.channel;
  }
  return null;
};

//添加玩家to队伍频道中，返回true或false
Team.prototype.addPlayer2Channel = function(data) {
  if(!this.channel) {
    return false;
  }
  if(data) {
    this.channel.add(data.userId, data.serverId);
    return true;
  }
  return false;
};

//从队伍频道中移除玩家， 返回true或false
Team.prototype.removePlayerFromChannel = function(data) {
  if(!this.channel) {
    return false;
  }
  if(data) {
    utils.myPrint('data.userId, data.serverId = ', data.userId, data.serverId);
    this.channel.leave(data.userId, data.serverId);
    return true;
  }
  return false;
};

//声明一个添加玩家的函数，返回true或false （data为{添加队员参数}，playerInfo才是队员信息，playerData为该玩家数据《hp、MP、等级等》）
function doAddPlayer(teamObj, data, isCaptain) {
  isCaptain = isCaptain || false;
  //队员数组
  var arr = teamObj.playerDataArray;
  //遍历队员数组，如果遍历到空位，则赋值，并返回ture，不会继续遍历下去；只添加一个队员。如果遍历完数组都没有true，那么返回false
  for(var i in arr) {
    if(arr[i].playerId === consts.TEAM.PLAYER_ID_NONE && arr[i].areaId === consts.TEAM.AREA_ID_NONE) {
      //参数的玩家数据的playerData的teamId赋值
      data.playerInfo.playerData.teamId = teamObj.teamId;
      
      //如果加入的玩家是队长的话
      if (isCaptain) {
        //给队伍配置【队伍名】
        teamObj.teamName = data.teamName;
        //参数的队员信息的玩家数据的isCaptain属性为yes
        data.playerInfo.playerData.isCaptain = consts.TEAM.YES;
      }
      utils.myPrint('data.playerInfo = ', JSON.stringify(data.playerInfo));
      //赋值一个【队员数据】到队伍，这个是加入队伍后的队员信息
      arr[i] = {playerId: data.playerId, areaId: data.areaId, userId: data.userId,
        serverId: data.serverId, backendServerId: data.backendServerId,
        playerData: data.playerInfo.playerData};
      utils.myPrint('arr[i] = ', JSON.stringify(arr[i]));
      return true;
    }
  }
  return false;
}

//队伍加入一个玩家，并确定是不是队长，并队伍频道推送消息给队员们（data参数是area服务器teamHandler.js提供）（data为{添加队员参数}）
Team.prototype.addPlayer = function(data, isCaptain) {
  isCaptain = isCaptain || false;
  //判断参数data是否为对象
  if (!data || typeof data !== 'object') {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }
  //判断参数data每一个属性是否有值
  for (var i in data) {
    if(!data[i] || data[i] <= 0) {
      return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
    }
  }

  //判断队伍还有空位
  if(!this.isTeamHasPosition()) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.NO_POSITION;
  }

  //判断该玩家是否已经有队伍了
  if(this.isPlayerInTeam(data.playerId)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.ALREADY_IN_TEAM;
  }

  //执行添加玩家函数，并用返回结果作为判断条件
  if(!doAddPlayer(this, data, isCaptain)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //在执行添加玩家操作后，判断玩家是否加入队伍了
  if(!this.isPlayerInTeam(data.playerId)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //执行添加玩家后，是否也加入到队伍频道了
  if(!this.addPlayer2Channel(data)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //如果还有空位，则【玩家数量加1】
  if(this.playerNum < MAX_MEMBER_NUM) {
    this.playerNum++;
  }

  //更新队伍信息，并推送信息给每一个队员
  this.updateTeamInfo();

  //最后返回成功码
  return consts.TEAM.JOIN_TEAM_RET_CODE.OK;
};


// the captain_id is just a player_id
// 【设置队长id】
Team.prototype.setCaptainId = function(captainId) {
  this.captainId = captainId;
};

// is the player the captain of the team
// 判断通过玩家id判断是否队长id
Team.prototype.isCaptainById = function(playerId) {
  return playerId === this.captainId;
};

// player num in the team
// 获取队员数量
Team.prototype.getPlayerNum = function() {
  return this.playerNum;
};

// is there a empty position in the team
// 判断队伍是否还有空位
Team.prototype.isTeamHasPosition = function() {
  return this.getPlayerNum() < MAX_MEMBER_NUM;
};

// is there any member in the team
// 判断队伍是否有人
Team.prototype.isTeamHasMember = function() {
  return this.getPlayerNum() > 0;
};

// the first real player_id in the team
Team.prototype.getFirstPlayerId = function() {
  var arr = this.playerDataArray;
  for(var i in arr) {
    if(arr[i].playerId !== consts.TEAM.PLAYER_ID_NONE && arr[i].areaId !== consts.TEAM.AREA_ID_NONE) {
      return arr[i].playerId;
    }
  }
  return consts.TEAM.PLAYER_ID_NONE;
};

// check if a player in the team
// 判断玩家是否已经在队伍中
Team.prototype.isPlayerInTeam = function(playerId) {
  var arr = this.playerDataArray;
  utils.myPrint('arr = ', JSON.stringify(arr));
  utils.myPrint('playerId = ', playerId);
  for(var i in arr) {
    if(arr[i].playerId !== consts.TEAM.PLAYER_ID_NONE && arr[i].playerId === playerId) {
      return true;
    }
  }
  return false;
};

// push the team members' info to everyone
// 推送队伍更新信息给每一位队员
Team.prototype.updateTeamInfo = function() {
  var infoObjDict = {};  //要推送的玩家数据组
  var arr = this.playerDataArray;  //获取队员数组
  
  //遍历队员数组，如果是空位，继续遍历下一个。如果是实位，推送对象添加该玩家数据
  for (var i in arr) {
    var playerId = arr[i].playerId;
    if(playerId === consts.TEAM.PLAYER_ID_NONE) {
      continue;
    }
    infoObjDict[playerId] = arr[i].playerData;
    utils.myPrint('infoObjDict[playerId] = ', JSON.stringify(infoObjDict[playerId]));
    utils.myPrint('playerId, kindId = ', playerId, infoObjDict[playerId].kindId);
  }

  //队伍频道推送消息给队员们
  if(Object.keys(infoObjDict).length > 0) {
    this.channel.pushMessage('onUpdateTeam', infoObjDict, null);
  }
};

// notify the members of the left player
Team.prototype.pushLeaveMsg2All = function(leavePlayerId, cb) {
  var ret = {result: consts.TEAM.OK};
  if(!this.channel) {
    cb(null, ret);
    return;
  }
  var msg = {
    playerId: leavePlayerId
  };
  this.channel.pushMessage('onTeammateLeaveTeam', msg, function(err, _) {
    cb(null, ret);
  });
};

// disband the team
Team.prototype.disbandTeam = function() {
  var playerIdArray = [];
  var arr = this.playerDataArray;
  utils.myPrint('DisbandTeam ~ arr = ', JSON.stringify(arr));
  for(var i in arr) {
    var playerId = arr[i].playerId;
    if (playerId === consts.TEAM.PLAYER_ID_NONE || arr[i].areaId === consts.TEAM.AREA_ID_NONE) {
      continue;
    }
    playerIdArray.push(playerId);
    //rpc invoke
    var params = {
      namespace : 'user',
      service: 'playerRemote',
      method: 'leaveTeam',
      args: [{
        playerId: playerId, instanceId: arr[i].playerData.instanceId
      }]
    };

    utils.myPrint('playerId = ', playerId);
    utils.myPrint('arr[i].backendServerId = ', arr[i].backendServerId);
    utils.myPrint('params = ', JSON.stringify(params));
    pomelo.app.rpcInvoke(arr[i].backendServerId, params, function(err, _){
      if(!!err) {
        console.warn(err);
      }
    });
  }
  if (playerIdArray.length > 0) {
    this.channel.pushMessage('onDisbandTeam', playerIdArray, null);
  }

  this.playerNum = 0;
  return {result: consts.TEAM.OK};
};

// remove a player from the team
Team.prototype.removePlayer = function(playerId, cb) {
  var arr = this.playerDataArray;
  var tmpData = null;
  for(var i in arr) {
    if(arr[i].playerId !== consts.TEAM.PLAYER_ID_NONE && arr[i].playerId === playerId) {
      tmpData = utils.clone(arr[i]);
      arr[i] = {playerId: consts.TEAM.PLAYER_ID_NONE, areaId: consts.TEAM.AREA_ID_NONE,
        userId: consts.TEAM.USER_ID_NONE, serverId: consts.TEAM.SERVER_ID_NONE,
        backendServerId: consts.TEAM.SERVER_ID_NONE, playerData: consts.TEAM.PLAYER_INFO_NONE};
      break;
    }
  }

  if(this.isPlayerInTeam(playerId)) {
    var ret = {result: consts.TEAM.FAILED};
    utils.invokeCallback(cb, null, ret);
    return false;
  }

  var _this = this;
  // async network operation
  this.pushLeaveMsg2All(playerId, function(err, ret) {
    // if the captain leaves the team, disband the team
    if (_this.isCaptainById(playerId)) {
      ret = _this.disbandTeam();
    } else {
      _this.removePlayerFromChannel(tmpData);
    }

    if(_this.playerNum > 0) {
      _this.playerNum--;
    }

    utils.myPrint('_this.playerNum = ', _this.playerNum);
    if(_this.playerNum > 0) {
      _this.updateTeamInfo();
    }
    utils.invokeCallback(cb, null, ret);
  });

  //rpc invoke
  var params = {
    namespace : 'user',
    service: 'playerRemote',
    method: 'leaveTeam',
    args: [{
      playerId: tmpData.playerId, instanceId: tmpData.playerData.instanceId
    }]
  };
  utils.myPrint('params = ', JSON.stringify(params));
  pomelo.app.rpcInvoke(tmpData.backendServerId, params, function(err, _){
    if(!!err) {
      console.warn(err);
      return false;
    }
  });

  if (_this.isCaptainById(playerId)) {
    return true;
  } else {
    return false;
  }
};

// push msg to all of the team members 
Team.prototype.pushChatMsg2All = function(content) {
  if(!this.channel) {
    return false;
  }
  var playerId = content.playerId;
  utils.myPrint('1 ~ content = ', JSON.stringify(content));
  if(!this.isPlayerInTeam(playerId)) {
    return false;
  }
  utils.myPrint('2 ~ content = ', JSON.stringify(content));
  this.channel.pushMessage(Event.chat, content, null);
  return true;
};

Team.prototype.dragMember2gameCopy = function(args, cb) {
  if(!this.channel) {
    utils.invokeCallback(cb, 'Team without channel! %j', {teamId: this.teamId, captainId: this.captainId});
    return;
  }
  utils.myPrint('3 ~ DragMember2gameCopy ~ args = ', JSON.stringify(args));
  this.channel.pushMessage('onDragMember2gameCopy', args, null);
  utils.invokeCallback(cb);
};

Team.prototype.updateMemberInfo = function(data) {
  utils.myPrint('data = ', data);
  utils.myPrint('playerData = ', data.playerData);
  if (this.teamId !== data.playerData.teamId) {
    return false;
  }
  var arr = this.playerDataArray;
  for(var i in arr) {
    if(arr[i].playerId === data.playerId) {
      if (!!data.backendServerId) {
        arr[i].backendServerId = data.backendServerId;
      }
      arr[i].areaId = data.areaId;
      arr[i].playerData = data.playerData;
      utils.myPrint('arr[i] = ', JSON.stringify(arr[i]));
      if (data.needNotifyElse) {
        this.updateTeamInfo();
      }
      return true;
    }
  }
  return false;
};

///////////////////////////////////////////////////////
/**
 * Expose 'Team' constructor.
 */
module.exports = Team;

