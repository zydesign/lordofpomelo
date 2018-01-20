/**
 * Module dependencies
 */
var Team = require('../domain/entity/team');
var consts = require('../consts/consts');
var utils = require('../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);
//团队管理服务，team的管理类（这里所有函数都由manager服务器调用）
var exp = module.exports;

// global team container(teamId:teamObj)  
var gTeamObjDict = {};  // 团队组{teamId:teamObj,teamId:teamObj...}

var gTeamId = 0;        // 队伍数量

// create new team, add the player(captain) to the team
// 创建队伍。（参数data：用于生成完整队员信息的队员数据）-----------------------------------------------------【创建队伍，添加队员】
exp.createTeam = function(data) {
  var teamObj = new Team(++gTeamId);  //生成一支空队伍（都是空位）
  var result = teamObj.addPlayer(data, true); //队伍增加一个队员，参数true就表示该玩家是队长。
  
  //如果队伍添加队员成功，队伍设置队长id，将队伍加入队伍组
  if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
    teamObj.setCaptainId(data.playerId);   
    gTeamObjDict[teamObj.teamId] = teamObj;
  }
  //返回结果给area服务器teamHandler.js
  return {result: result, teamId: teamObj.teamId};
};

exp.getTeamById = function(teamId) {
  var teamObj = gTeamObjDict[teamId];
  return teamObj || null;
};
//通过id解散队伍。先让所有队员离开队伍，然后删除该队伍-----------------------------------------------------解散队伍
exp.disbandTeamById = function(playerId, teamId) {
  var teamObj = gTeamObjDict[teamId];
  if(!teamObj || !teamObj.isCaptainById(playerId)) {
    return {result: consts.TEAM.FAILED};
  }

  //队伍实例执行解散队伍。就是让每一个队员离开队伍。返回ret：{result: consts.TEAM.OK}
  var ret = teamObj.disbandTeam();
  
  //从队伍数组中删除该队伍
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

//离开队伍。（1.客户端掉线 2.玩家主动离队）
exp.leaveTeamById = function(playerId, teamId, cb) {
  var teamObj = gTeamObjDict[teamId];  //队伍组中获取指定id的队伍
  //如果队伍不存在，cb离队失败
  if(!teamObj) {
    utils.invokeCallback(cb, null, {result: consts.TEAM.FAILED});
    return;
  }

  // 执行队伍删除队员。调用teamObj.removePlayer（msg，cb）的cb的值作为解散需求的判定条件
  var needDisband = teamObj.removePlayer(playerId, function(err, ret) {
    utils.invokeCallback(cb, null, ret);
  });
  //解散需求为true（离队队员为队长）
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
