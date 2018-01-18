/**
 * Module dependencies
 */
var Team = require('../domain/entity/team');
var consts = require('../consts/consts');
var utils = require('../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);
//团队管理器
var exp = module.exports;

// global team container(teamId:teamObj)  
var gTeamObjDict = {};  //团队组
// global team id    
var gTeamId = 0;  //全局队伍id

// create new team, add the player(captain) to the team
// 新建队伍实例。然后增加玩家队长到队伍中，（manager服务器teamRemote.js使用这个函数，参数data是area服务器teamHandler.js提供的{添加队员参数}）
exp.createTeam = function(data) {
  var teamObj = new Team(++gTeamId);  //队伍对象为一个{新建的队伍实例}
  var result = teamObj.addPlayer(data, true); //队伍实例通过参数增加一个玩家，参数true就表示创建的玩家是队长。
  
  //result返回的结果做条件判断，如果队伍实例添加玩家队长成功，队伍实例设置队长id，全局队伍添加这支队伍
  if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
    //队伍实例【设置队长id】
    teamObj.setCaptainId(data.playerId);
    //全局队伍添加这支队伍
    gTeamObjDict[teamObj.teamId] = teamObj;
  }
  //返回结果给area服务器teamHandler.js
  return {result: result, teamId: teamObj.teamId};
};

exp.getTeamById = function(teamId) {
  var teamObj = gTeamObjDict[teamId];
  return teamObj || null;
};

exp.disbandTeamById = function(playerId, teamId) {
  var teamObj = gTeamObjDict[teamId];
  if(!teamObj || !teamObj.isCaptainById(playerId)) {
    return {result: consts.TEAM.FAILED};
  }

  var ret = teamObj.disbandTeam();
  if(ret.result) {
    delete gTeamObjDict[teamId];
  }
  return ret;
};

// check member num when a member leaves the team,
// if there is no member in the team,
// disband the team automatically
exp.try2DisbandTeam = function(teamObj) {
  if(!teamObj.isTeamHasMember()) {
    delete gTeamObjDict[teamObj.teamId];
  }
};

//离开队伍。（管理服务器manager/remote/teamRemote.leaveTeamById调用该函数）
exp.leaveTeamById = function(playerId, teamId, cb) {
  var teamObj = gTeamObjDict[teamId];  //队伍组中获取指定id的队伍
  //如果队伍不存在，cb
  if(!teamObj) {
    utils.invokeCallback(cb, null, {result: consts.TEAM.FAILED});
    return;
  }

  // 执行队伍删除队员
  var needDisband = teamObj.removePlayer(playerId, function(err, ret) {
    utils.invokeCallback(cb, null, ret);
  });
  if (needDisband) {
    utils.myPrint('delete gTeamObjDict[teamId] ...');
    delete gTeamObjDict[teamId];
  }
};

exp.dragMember2gameCopy = function(args, cb) {
  utils.myPrint('2 ~ DragMember2gameCopy ~ args = ', JSON.stringify(args));
  var teamId = args.teamId;
  if (!teamId) {
    utils.invokeCallback(cb, 'No teamId! %j', args);
    return;
  }
  var teamObj = gTeamObjDict[teamId];
  if(!teamObj) {
    utils.invokeCallback(cb, 'No teamObj! %j', args);
    return;
  }
  teamObj.dragMember2gameCopy(args, cb);
};

exp.applyJoinTeam = function(args) {
  var result = consts.TEAM.FAILED;
  if (!args || !args.teamId) {
    return {result: result};
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  if (teamObj) {
    if (teamObj.isTeamHasPosition() && !teamObj.isPlayerInTeam(args.applicantId)) {
      result = consts.TEAM.OK;
    }
  }

  return {result: result};
};

exp.acceptApplicantJoinTeam = function(args) {
  var result = consts.TEAM.FAILED;
  var teamName = consts.TEAM.DEFAULT_NAME;
  if (!args || !args.teamId) {
    return {result: result};
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  if (teamObj) {
    if(!teamObj.isCaptainById(args.captainId)) {
      return {result: result};
    }
    result = teamObj.addPlayer(args);
    teamName = teamObj.teamName;
  }
  return {result: result, teamName: teamName};
};

exp.inviteJoinTeam = function(args) {
  var result = consts.TEAM.FAILED;
  if (!args || !args.teamId) {
    return {result: result};
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  if (teamObj) {
    if (teamObj.isTeamHasPosition() && teamObj.isCaptainById(args.captainId)) {
      result = consts.TEAM.OK;
    }
  }

  return {result: result};
};

exp.acceptInviteJoinTeam = function(args) {
  var result = consts.TEAM.FAILED;
  var teamName = consts.TEAM.DEFAULT_NAME;
  if (!args || !args.teamId) {
    return {result: result};
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  if (teamObj) {
    if(!teamObj.isCaptainById(args.captainId)) {
      return {result: result};
    }
    result = teamObj.addPlayer(args);
    teamName = teamObj.teamName;
  }
  return {result: result, teamName: teamName};
};

//更新队员信息。args为player生成的玩家数据。（管理服务器manager/remote/teamRemote.updateMemberInfo执行该函数）
exp.updateMemberInfo = function(args) {
  var result = consts.TEAM.FAILED;
  //如果参数不存在
  if (!args || !args.playerData.teamId) {
    return {result: result};
  }
  
  var teamId = args.playerData.teamId;
  var teamObj = gTeamObjDict[teamId];   //通过队伍id从队伍组获取队伍
  //执行队伍更新队员信息--------------------------------------------------------------这里开始更新队员信息
  if (teamObj && teamObj.updateMemberInfo(args)) {
    result = consts.TEAM.OK;
  }

  return {result: result};
};

exp.chatInTeam = function(args) {
  var result = consts.TEAM.FAILED;
  if (!args || !args.teamId) {
    return {result: result};
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  utils.myPrint('args = ', JSON.stringify(args));
  utils.myPrint('teamObj = ', teamObj);
  if (teamObj && teamObj.pushChatMsg2All(args.content)) {
    result = consts.TEAM.OK;
  }

  return {result: result};
};


exp.kickOut = function(args, cb) {
  if (!args || !args.teamId) {
    utils.invokeCallback(cb, null, {result: consts.TEAM.FAILED});
    return;
  }
  var teamId = args.teamId;
  var teamObj = gTeamObjDict[teamId];
  if (teamObj) {
    if(!teamObj.isCaptainById(args.captainId)) {
      logger.warn('The request(kickOut) is illegal, the captainId is wrong : args = %j.', args);
      utils.invokeCallback(cb, null, {result: consts.TEAM.FAILED});
      return;
    }
    teamObj.removePlayer(args.kickedPlayerId, function(err, ret) {
      utils.invokeCallback(cb, null, ret);
    });
  }
};
