/**
 * Module dependencies
 */
var consts = require('../../consts/consts');
var pomelo = require('pomelo');
var utils = require('../../util/utils');
var channelUtil = require('../../util/channelUtil');
var Event = require('../../consts/consts').Event;

//团队类。（该类的实例和所有函数都是由services/teamManager.js的调用）

// max member num in a team
// 队伍成员最大数
var MAX_MEMBER_NUM = 3;

//通过队伍id可以实例队伍（services/teamManager.createTeam调用该函数）
function Team(teamId){
  this.teamId = 0;
  this.teamName = consts.TEAM.DEFAULT_NAME; //默认队伍名为null
  this.playerNum = 0;  //玩家数量
  this.captainId = 0;  //队长id
  this.playerDataArray = new Array(MAX_MEMBER_NUM); //3个队员的队员信息组
  // team channel, push msg within the team
  this.channel = null;  //该队伍频道

  init(teamId);   //立即执行初始化，赋值this.teamId、this.channel、this.playerDataArray
}


//初始化函数
Team.prototype.init = function(teamId)	{
    //teamId是参数
    this.teamId = teamId;  //得到this.teamId-----------------------------------------------------------添加teamId
    //配置队伍空位信息。（属性有：playerId、areaId、userId、serverId、backendServerId、playerData）---------配置队伍空位
    //ps：instanceId副本id、teamId团队id、isCaptain队长值是存在playerData中的
    for(var i = 0; i < this.playerDataArray.length; ++i) {
      this.playerDataArray[i] = {playerId: consts.TEAM.PLAYER_ID_NONE, areaId: consts.TEAM.AREA_ID_NONE,
        userId: consts.TEAM.USER_ID_NONE, serverId: consts.TEAM.SERVER_ID_NONE,
        backendServerId: consts.TEAM.SERVER_ID_NONE, playerData: consts.TEAM.PLAYER_INFO_NONE};
    }
    this.createChannel();  //执行创建队伍函数
  };


//创建队伍频道。得到this.channel
Team.prototype.createChannel = function() {
  if(this.channel) {
    return this.channel;
  }
  var channelName = channelUtil.getTeamChannelName(this.teamId);  //频道工具获取队伍频道名
  this.channel = pomelo.app.get('channelService').getChannel(channelName, true);   //创建一个频道
  if(this.channel) {
    return this.channel;
  }
  return null;
};

//添加玩家to队伍频道中，返回true或false（data是player生成的玩家数据）
Team.prototype.addPlayer2Channel = function(data) {
  if(!this.channel) {
    return false;
  }
  if(data) {
    this.channel.add(data.userId, data.serverId);   //队伍频道添加玩家
    return true;
  }
  return false;
};

//从队伍频道中移除玩家， 返回true或false（data是player生成的玩家数据）
Team.prototype.removePlayerFromChannel = function(data) {
  if(!this.channel) {
    return false;
  }
  if(data) {
    utils.myPrint('data.userId, data.serverId = ', data.userId, data.serverId);
    this.channel.leave(data.userId, data.serverId);   //队伍频道删除玩家
    return true;
  }
  return false;
};

//添加队员函数。返回true或false -------------------------------------------------------------------------------------------------
//（data是area/handler/teamHandler.createTeam生成的玩家数据,data.playerInfo是player生成的不完整队员信息，playerData为玩家属性）
function doAddPlayer(data, isCaptain) {
  isCaptain = isCaptain || false;
  //遍历队员数组，如果遍历到空位，则赋值，并返回ture，不会继续遍历下去；只添加一个队员。如果遍历完数组空位，那么返回false
  for(var i in this.playerDataArray) {
    //如果有空位
    if(this.playerDataArray[i].playerId === consts.TEAM.PLAYER_ID_NONE && this.playerDataArray[i].areaId === consts.TEAM.AREA_ID_NONE) {
      //参数的玩家属性添加teamId属性-------------------------------添加teamId属性（队员属性）
      data.playerInfo.playerData.teamId = this.teamId;
      
      //如果加入的是队长。那这支队伍就是新的空队伍，给空队伍添加teamName
      if (isCaptain) {
        //给队伍配置队伍名----------------------------------------添加队伍名
        this.teamName = data.teamName;
        ///参数的玩家属性添加isCaptain属性-------------------------添加队长属性（队员属性）
        data.playerInfo.playerData.isCaptain = consts.TEAM.YES;
      }
      utils.myPrint('data.playerInfo = ', JSON.stringify(data.playerInfo));
      //赋值一个【完整队员信息】到队伍，这个是加入队伍后的队员信息------------------------------生成完整队员信息
      this.playerDataArray[i] = {playerId: data.playerId, areaId: data.areaId, userId: data.userId,
        serverId: data.serverId, backendServerId: data.backendServerId,
        playerData: data.playerInfo.playerData};
      utils.myPrint('this.playerDataArray[i] = ', JSON.stringify(this.playerDataArray[i]));
      return true;
    }
  }
  return false;
}

//添加一个名队员。队伍频道推送消息给队员们-------------------------------------------------------------------------【添加队员】
//（data是area/handler/teamHandler.createTeam生成的玩家数据,data.playerInfo是player生成的不完整队员信息，playerData为玩家属性）
Team.prototype.addPlayer = function(data, isCaptain) {
  isCaptain = isCaptain || false;  //创建队伍的玩家是队长，
  //判断参数data是否为对象
  if (!data || typeof data !== 'object') {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;    //系统错误码
  }
  //判断参数data每一个属性是否有值
  for (var i in data) {
    if(!data[i] || data[i] <= 0) {
      return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
    }
  }

  //如果队伍没空位
  if(!this.isTeamHasPosition()) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.NO_POSITION;     //没空位码
  }

  //如果该玩家已经有队伍
  if(this.isPlayerInTeam(data.playerId)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.ALREADY_IN_TEAM;  //已有队伍码
  }

  //如果【执行添加玩家】失败-----------------------------------------------------这里加入队伍
  if(!doAddPlayer(data, isCaptain)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //在执行添加玩家后，如果该玩家不在队伍中
  if(!this.isPlayerInTeam(data.playerId)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //如果执行添加玩家到队伍频道失败----------------------------------------------队员加入队伍频道
  if(!this.addPlayer2Channel(data)) {
    return consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  }

  //如果还有空位，则【玩家数量加1】
  if(this.playerNum < MAX_MEMBER_NUM) {
    this.playerNum++;
  }

  //推送信息给每一个队员，让客户端刷新队员属性-----------------------------------------新队员加入要告诉其他队员
  this.updateTeamInfo();

  //最后返回成功码
  return consts.TEAM.JOIN_TEAM_RET_CODE.OK;   //加入成功码
};


// the captain_id is just a player_id
// 【设置队长id】--------------------------------------------------------------------【给队伍设置队长playerId】
Team.prototype.setCaptainId = function(captainId) {
  this.captainId = captainId;
};

// is the player the captain of the team
// 玩家id是否队长id
Team.prototype.isCaptainById = function(playerId) {
  return playerId === this.captainId;
};

// player num in the team
// 获取队员数量
Team.prototype.getPlayerNum = function() {
  return this.playerNum;
};

// is there a empty position in the team
// 队伍是否有空位
Team.prototype.isTeamHasPosition = function() {
  return this.getPlayerNum() < MAX_MEMBER_NUM;
};

// is there any member in the team
// 判断队伍是否有人，队员数量大于0
Team.prototype.isTeamHasMember = function() {
  return this.getPlayerNum() > 0;
};

// the first real player_id in the team
//获取第一个队员的playerId
Team.prototype.getFirstPlayerId = function() {
  var arr = this.playerDataArray;
  //如果遍历到队伍位置不为空，就是第一个队员
  for(var i in arr) {
    if(arr[i].playerId !== consts.TEAM.PLAYER_ID_NONE && arr[i].areaId !== consts.TEAM.AREA_ID_NONE) {
      return arr[i].playerId;
    }
  }
  //如果遍历整支队伍都是空位，返回空队员码
  return consts.TEAM.PLAYER_ID_NONE;
};

// check if a player in the team
// 判断玩家是否已经在队伍中
Team.prototype.isPlayerInTeam = function(playerId) {
  var arr = this.playerDataArray;
  utils.myPrint('arr = ', JSON.stringify(arr));
  utils.myPrint('playerId = ', playerId);
  //遍历队伍，如果有队员playerId跟参数一样，返回true
  for(var i in arr) {
    if(arr[i].playerId !== consts.TEAM.PLAYER_ID_NONE && arr[i].playerId === playerId) {
      return true;
    }
  }
  return false;
};

// push the team members' info to everyone
// 推送所有队员属性到客户端--------------------------------------------------------------------------【让客户端刷新队员属性】
Team.prototype.updateTeamInfo = function() {
  var infoObjDict = {};  //队员属性组
  var arr = this.playerDataArray;  //获取队员数组
  
  //遍历队员数组，如果是空位，继续遍历下一个。如果是实位，队员数据加入infoObjDict组，推送对象添加该玩家数据
  for (var i in arr) {
    var playerId = arr[i].playerId;
    if(playerId === consts.TEAM.PLAYER_ID_NONE) {
      continue;
    }
    infoObjDict[playerId] = arr[i].playerData;  //存入所有队员属性--------------------------------
    utils.myPrint('infoObjDict[playerId] = ', JSON.stringify(infoObjDict[playerId]));
    utils.myPrint('playerId, kindId = ', playerId, infoObjDict[playerId].kindId);
  }

  //生成实位队员playerId组，频道推送消息
  if(Object.keys(infoObjDict).length > 0) {
    this.channel.pushMessage('onUpdateTeam', infoObjDict, null);  //给队伍频道推送队员数据
  }
};

// notify the members of the left player
// 队伍推送消息队员离开---------------------------------------------------------------玩家离开，队伍频道通知
Team.prototype.pushLeaveMsg2All = function(leavePlayerId, cb) {
  var res = {result: consts.TEAM.OK};
  //如果频道不存在
  if(!this.channel) {
    cb(null, res);
    return;
  }
  //发给客户端的msg
  var msg = {
    playerId: leavePlayerId
  };
  this.channel.pushMessage('onTeammateLeaveTeam', msg, function(err, _) {
    cb(null, res);
  });
};

// disband the team
//解散队伍，只有队长才有资格解散队伍。让队伍所有成员离队。---------------------------------------------------------------【解散队伍】
Team.prototype.disbandTeam = function() {
  var playerIdArray = [];  //队员id数组
  var arr = this.playerDataArray;
  utils.myPrint('DisbandTeam ~ arr = ', JSON.stringify(arr));
  
  for(var i in arr) {
    var playerId = arr[i].playerId;
    //如果是空位，继续遍历下一个
    if (playerId === consts.TEAM.PLAYER_ID_NONE || arr[i].areaId === consts.TEAM.AREA_ID_NONE) {
      continue;
    }
    playerIdArray.push(playerId);    //队员id数组添加playerId
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
    //从队员信息获取后端id作为路由，rpc到area.playerRemote.leaveTeam。每个队员的player.teamId归零
    pomelo.app.rpcInvoke(arr[i].backendServerId, params, function(err, _){
      if(!!err) {
        console.warn(err);
      }
    });
  }         //遍历到这-----------------------------
  
  //队员id组有值，说明队伍有人，推送 “队伍解散” 这样的消息，客户端就会解散队伍，并显示“队伍解散”
  if (playerIdArray.length > 0) {
    this.channel.pushMessage('onDisbandTeam', playerIdArray, null);
  }

  this.playerNum = 0;
  return {result: consts.TEAM.OK};
};

// remove a player from the team
//队员离队。返回解散需求true或false，并把是否删除成功存入cb （1.玩家主动离队 2.玩家掉线）--------------------【队员离队】
//返回值true或false用于解散需求，cb用于是否离队成功（cb：{result: consts.TEAM.FAILED}或{result: consts.TEAM.OK}）
Team.prototype.removePlayer = function(playerId, cb) {
  var tmpData = null;  //备份队员信息
  for(var i in this.playerDataArray) {
    //让指定队员位置变为空位-------------------------------------------------------------------1 变空位
    if(this.playerDataArray[i].playerId !== consts.TEAM.PLAYER_ID_NONE && this.playerDataArray[i].playerId === playerId) {
      tmpData = utils.clone(this.playerDataArray[i]);
      this.playerDataArray[i] = {playerId: consts.TEAM.PLAYER_ID_NONE, areaId: consts.TEAM.AREA_ID_NONE,
        userId: consts.TEAM.USER_ID_NONE, serverId: consts.TEAM.SERVER_ID_NONE,
        backendServerId: consts.TEAM.SERVER_ID_NONE, playerData: consts.TEAM.PLAYER_INFO_NONE};
      break;
    }
  }

  //变空位后，还在队伍里，返回false
  if(this.isPlayerInTeam(playerId)) {
    var ret = {result: consts.TEAM.FAILED};
    utils.invokeCallback(cb, null, ret);
    return false;
  }

  var _this = this;  //this指向这里team，是因为异步函数调用
  // async network operation
  //推送队员离开的消息通知队友
  this.pushLeaveMsg2All(playerId, function(err, ret) {
    // if the captain leaves the team, disband the team
    //如果离队的队员是队长，执行解散队伍。所有玩家player.teamId归零。ret的值为解散队伍的{result: consts.TEAM.OK}
    if (_this.isCaptainById(playerId)) {
     ret = _this.disbandTeam();   
    } else {
      //如果不是队长，频道删除该玩家---------------------------------------------------------2 退出队伍频道
      _this.removePlayerFromChannel(tmpData);
    }

    //如果队员数量大于0，数量-1
    if(_this.playerNum > 0) {
      _this.playerNum--;
    }

    utils.myPrint('_this.playerNum = ', _this.playerNum);
    //队员数量-1后，队员数量大于0
    if(_this.playerNum > 0) {
      _this.updateTeamInfo();   //推送消息，客户端刷新队员属性
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
  //通过队员信息获取后端id作为路由，rpc到area.playerRemote.leaveTeam，让该玩家的player.teamId归零--------3 改player.teamId
  pomelo.app.rpcInvoke(tmpData.backendServerId, params, function(err, _){
    if(!!err) {
      console.warn(err);
      return false;
    }
  });

  //如果离队的是队长，解散需求为true
  if (_this.isCaptainById(playerId)) {
    return true;
  } else {
    return false;
  }
};

// push msg to all of the team members 
//队伍频道推送队伍聊天信息，成功返回true
Team.prototype.pushChatMsg2All = function(content) {
  if(!this.channel) {
    return false;
  }
  var playerId = content.playerId;
  utils.myPrint('1 ~ content = ', JSON.stringify(content));
  //如果玩家不在队伍
  if(!this.isPlayerInTeam(playerId)) {
    return false;
  }
  utils.myPrint('2 ~ content = ', JSON.stringify(content));
  //队伍推送聊天消息-------------------------------------
  this.channel.pushMessage(Event.chat, content, null);
  return true;
};

//将队员拉进副本----------------------------------------------------------------------------------------------【拉队员进副本】
Team.prototype.dragMember2gameCopy = function(args, cb) {
  if(!this.channel) {
    utils.invokeCallback(cb, 'Team without channel! %j', {teamId: this.teamId, captainId: this.captainId});
    return;
  }
  utils.myPrint('3 ~ DragMember2gameCopy ~ args = ', JSON.stringify(args));
  this.channel.pushMessage('onDragMember2gameCopy', args, null); //拉进副本消息推送，让客户端操作
  utils.invokeCallback(cb);
};

//更新队员信息，data是队员信息。如果更新成功，返回true--------------------------------------------------------------【更新队员信息】
Team.prototype.updateMemberInfo = function(data) {
  utils.myPrint('data = ', data);
  utils.myPrint('playerData = ', data.playerData);
  //如果团队id不匹配参数的队员teamId，返回false
  if (this.teamId !== data.playerData.teamId) {
    return false;
  }
  for(var i in this.playerDataArray) {
    if(this.playerDataArray[i].playerId === data.playerId) {
      //如果参数队员有后端id，更新队伍中这个队员的后端id
      if (!!data.backendServerId) {
        this.playerDataArray[i].backendServerId = data.backendServerId;   //更新后端id
      }
      this.playerDataArray[i].areaId = data.areaId;                       //更新areaId
      this.playerDataArray[i].playerData = data.playerData;               //更新角色属性playerData
      utils.myPrint('this.playerDataArray[i] = ', JSON.stringify(this.playerDataArray[i]));
      //如果需要通知所有人，推送消息，让客户端更新队伍信息
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

