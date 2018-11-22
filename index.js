'use strict';

const http = require('http');
const qs = require('querystring');
// const {google} = require('googleapis'); // Add "googleapis": "^33.0.0", to package.json 'dependencies' when you enable this again.
const request = require('request');
const moment = require('moment');

function formatSlackMessage (incidentId, incidentName, slackUserName, incidentSlackChannel) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  var slackMessage = {
    username: 'Incident Management',
    icon_emoji: ':warning:',
    channel: 'incident',
    attachments: [],
    link_names: true,
    parse: 'full',
  };

  slackMessage.attachments.push({
      color: '#000000',
      title: "Incident",
      text: incidentName,
      footer: `reported by @${slackUserName}`
  });

  // Slack channel
  slackMessage.attachments.push({
      color: '#8f0000',
      title: 'Slack channel',
      text: '#' + incidentSlackChannel
  });

  return slackMessage;
}

function verifyPostRequest(method) {
  if (method !== 'POST') {
    const error = new Error('Only POST requests are accepted');
    error.code = 405;
    throw error;
  }
}

function verifySlackWebhook (body) {
  if (!body || body.token !== process.env.SLACK_COMMAND_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

function createIncidentFlow (body) {
  var incidentId = moment().format('YYMMDDHHmm');
  var incidentName = body.text;
  var incidentManagerSlackHandle = body.user_name;

  var incidentSlackChannel = createSlackChannel(incidentId);

  // Return a formatted message
  var slackMessage = formatSlackMessage(incidentId, incidentName, incidentManagerSlackHandle, incidentSlackChannel, googleDocUrl);

  // Bit of delay before posting message to channels, to make sure channel is created
  setTimeout(function () {
      sendSlackMessageToChannel(process.env.SLACK_INCIDENTS_CHANNEL, slackMessage);
      sendSlackMessageToChannel(incidentSlackChannel, slackMessage)
    },
    500
  );
}

function createSlackChannel (incidentId) {
  var incidentSlackChannel = process.env.SLACK_INCIDENT_CHANNEL_PREFIX + incidentId;

  // return process.env.SLACK_INCIDENT_CHANNEL_PREFIX + '000000';

  request.post({
    url:'https://slack.com/api/channels.create',
    form: {
      token: process.env.SLACK_API_TOKEN,
      name: '#' + incidentSlackChannel
    }
  },
  function(error, response, body) {
    if (error) {
      console.error('Creating Slack channel failed:', error);

      throw new Error('Creating Slack channel failed');
    }
  });

  return incidentSlackChannel;
}

function sendSlackMessageToChannel(slackChannel, slackMessage) {
  const newMessage = {
    ...slackMessage,
    channel: '#' + slackChannel
  };

  request.post({
    url:'https://slack.com/api/chat.postMessage',
    auth: {
      'bearer': process.env.SLACK_API_TOKEN
    },
    json: newMessage
  },
  function(error, response, body) {
    if (error) {
      console.error('Sending message to Slack channel failed:', error);

      throw new Error('Sending message to Slack channel failed');
    }
  });
}

http.createServer(function(req, res) {
  try {
    verifyPostRequest(req.method);

    var body = '';
    var post = {};
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      console.log('body: ' + body);
      post = qs.parse(body);

      verifySlackWebhook(post);

      createIncidentFlow(post);

      console.log('Successful execution of incident flow');

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.write(JSON.stringify({text: "Incident management process started"}));
      res.end();
    });
  } catch (error) {
      console.log(error);

      res.writeHead((error.code ? error.code : 500), {'Content-Type': 'application/json'});
      res.write(JSON.stringify({response_type: "in_channel", text: error.message}));
      res.end();
  }
}).listen(process.env.PORT ? process.env.PORT : 8080);
