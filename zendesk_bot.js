const WickrIOAPI = require('wickrio_addon');
const WickrIOBotAPI = require('wickrio-bot-api');
const WickrUser = WickrIOBotAPI.WickrUser;
const bot = new WickrIOBotAPI.WickrIOBot();
var zendesk = require('node-zendesk');
var fs = require('fs');

module.exports = WickrIOAPI;
process.stdin.resume(); //so the program will not close instantly

async function exitHandler(options, err) {
  try {
    var closed = await bot.close();
    if (err || options.exit) {
      console.log('Exit reason:', err);
      process.exit();
    } else if (options.pid) {
      process.kill(process.pid);
    }
  } catch (err) {
    console.log(err);
  }
}

//catches ctrl+c and stop.sh events
process.on('SIGINT', exitHandler.bind(null, {
  exit: true
}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {
  pid: true
}));
process.on('SIGUSR2', exitHandler.bind(null, {
  pid: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
  exit: true,
  reason: 'uncaughtException'
}));

var bot_username, zendesk_username, zendesk_api_token, zendesk_domain_name;
var tokens = JSON.parse(process.env.tokens);

return new Promise(async (resolve, reject) => {
  try {
    var status;
    if (process.argv[2] === undefined) {
      bot_username = tokens.BOT_USERNAME.value;
      status = await bot.start(bot_username)
      resolve(status);
    } else {
      status = await bot.start(process.argv[2]);
      resolve(status);
    }

  } catch (err) {
    return console.log(err);
  }
}).then(async result => {
  if (!result) {
    exitHandler(null, {
      exit: true,
      reason: 'Client not able to start'
    });
  }
  if (tokens.ZENDESK_USERNAME.encrypted) {
    zendesk_username = WickrIOAPI.cmdDecryptString(tokens.ZENDESK_USERNAME.value);
  } else {
    zendesk_username = tokens.ZENDESK_USERNAME.value;
  }
  if (tokens.ZENDESK_API_TOKEN.encrypted) {
    zendesk_api_token = WickrIOAPI.cmdDecryptString(tokens.ZENDESK_API_TOKEN.value);
  } else {
    zendesk_api_token = tokens.ZENDESK_API_TOKEN.value;
  }
  if (tokens.ZENDESK_DOMAIN_NAME.encrypted) {
    zendesk_domain_name = WickrIOAPI.cmdDecryptString(tokens.ZENDESK_DOMAIN_NAME.value);
  } else {
    zendesk_domain_name = tokens.ZENDESK_DOMAIN_NAME.value;
  }
  try {
    var client = zendesk.createClient({
      username: zendesk_username,
      token: zendesk_api_token,
      remoteUri: "https://" + zendesk_domain_name + ".zendesk.com/api/v2"
    });
    await bot.startListening(listen);
  } catch (err) {
    console.log(err);
    process.exit();
  }
  var fields = [];
  var fieldDescriptions = [];
  var responseMessageList = [
    "Hi! I'm the Wickr Support Bot and can help you get in touch with people who can assist with any questions or issues you might have. " +
    "Read more about me here: https://support.wickr.com/hc/en-us/articles/360015842253" +
    "\n\nAre you having any issues with the app?",
    "What is your contact name?"
  ];

  client.ticketfields.list(function(err, req, result) {
    if (err) {
      console.log(err);
      return;
    }
    for (var i in result) {
      var fieldChoices = [];
      if (result[i].required_in_portal) {
        var fieldObj = {
          "id": result[i].id,
          "value": ""
        };
        var title = {
          "title": result[i].title
        };
        fieldDescriptions.push(title);
        if (result[i].custom_field_options) {
          for (var x in result[i].custom_field_options) {
            var option = result[i].custom_field_options[x].value;
            fieldChoices.push(option);
          }
          fieldObj.custom_field_options = fieldChoices;
        }
        fields.push(fieldObj);
        if (i > 0) {
          if (fieldChoices.length > 0) {
            var displayChoices = fieldChoices.join('\n');
            var question = result[i].description + "\nPlease enter one of the following options:\n" + displayChoices;
          } else {
            var question = result[i].description;
          }
          responseMessageList.splice(i, 0, question);
        }
      }
    }
  });

  var zendeskTicket = {
    "subject": "",
    "comment": {
      "body": ""
    },
    "requester": {
      "name": "",
      "email": ""
    },
    "custom_fields": fields
    // "assignee": assignee //OPTIONAL
  };

  function listen(rMessage) {
    var parsedMessage = bot.parseMessage(rMessage);
    if (!parsedMessage) {
      return;
    }
    var command = parsedMessage.command;
    var message = parsedMessage.message;
    var argument = parsedMessage.argument;
    var userEmail = parsedMessage.userEmail;
    var vGroupID = parsedMessage.vgroupid;
    if ((command === '/help') || (message === 'help')) {
      var help = "/help - Lists all available commands\n" +
        "/list - Lists all available tickets(COMING SOON)\n" +
        "/get TICKET_ID - Retrieves the specified ticket(COMING SOON)\n" +
        "/delete TICKET_ID - Deletes the specified ticket(COMING SOON)\n";
      var sMessage = WickrIOAPI.cmdSendRoomMessage(vGroupID, help);
      console.log(sMessage);
    } else {
      /////////////////////////////////
      //start question flow
      /////////////////////////////////
      var user = bot.getUser(userEmail);
      if (user === undefined) {
        var wickrUser = new WickrUser(userEmail, {
          index: 0,
          current_vGroupID: vGroupID,
          command: "",
          argument: "",
          ticket: zendeskTicket,
          zendesk_id: "",
          tickets: []
        });
        bot.addUser(wickrUser);
        user = bot.getUser(userEmail);
      }
      var current = user.index;
      if (current < responseMessageList.length && current > 0) {
        if (zendeskTicket.custom_fields[current - 1].custom_field_options) {
          var result = zendeskTicket.custom_fields[current - 1].custom_field_options.indexOf(parsedMessage.message.toLowerCase());
          if (result === -1) {
            var options = zendeskTicket.custom_fields[current - 1].custom_field_options.join('\n');
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Invalid choice!\n\nPlease enter a choice from the following options:\n" + options));
          }
        }
        if (current === 1) {
          user.ticket.subject = parsedMessage.message;
          user.email = parsedMessage.userEmail;
          user.ticket.requester.email = parsedMessage.userEmail;
        } else if (current === 2) {
          user.ticket.comment.body = parsedMessage.message;
        }
        user.ticket.custom_fields[current - 1].value = parsedMessage.message.toLowerCase();
      } else if (current === responseMessageList.length) {
        user.ticket.requester.name = parsedMessage.message;
        console.log(parsedMessage)
        user.index = current + 1;
        var ticket = user.ticket;
        var confirmationMessage = ["Please confirm the information you entered:"];
        var answer;
        for (var x in fieldDescriptions) {
          answer = fieldDescriptions[x].title + ': ' + ticket.custom_fields[x].value;
          confirmationMessage.push(answer);
        }
        answer = 'Contact name: ' + ticket.requester.name;
        confirmationMessage.push(answer);
        answer = 'Email: ' + ticket.requester.email;
        confirmationMessage.push(answer);
        answer = "Is this accurate? (yes/no)";
        confirmationMessage.push(answer);
        confirmationMessage = confirmationMessage.join('\n');
        return WickrIOAPI.cmdSendRoomMessage(vGroupID, confirmationMessage);
      } else if (current === responseMessageList.length + 1) {
        user.index = 0;
        if (parsedMessage.message.toLowerCase() === 'yes' || parsedMessage.message.toLowerCase() === 'y') {
          var positiveResponse = "Great, please hold on while I create your ticket..."
          WickrIOAPI.cmdSendRoomMessage(vGroupID, positiveResponse);
          createTicket(user, function(result) {
            if (result instanceof Error) {
              console.log(result);
              var response = "Sorry, I was not able create this ticket, please try again later or email our support team at support@wickr.com.";
              var csrm = WickrIOAPI.cmdSendRoomMessage(user.current_vGroupID, response);
            } else {
              user = result;
            }
          });
          return;
        } else {
          var negativeResponse = "Okay, For further assitance you can email our support team at Support@wickr.com.\nYou can also start over again by telling me the issues you've been having?";
          user.index = 1; //DOUBLE CHECK THIS, MAYBE SHOULD BE 0 INSTEAD
          return WickrIOAPI.cmdSendRoomMessage(vGroupID, negativeResponse);
        }
      }
      current = user.index;
      console.log('user:', user)
      if (current < responseMessageList.length && current !== -1) {
        try {
          user.index = current + 1;
          return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, responseMessageList[current]));
        } catch (err) {
          return console.log(err);
        }
      }
    }
  }

  function createTicket(wickrUser, callback) {
    try {
      var ticketCopy = JSON.parse(JSON.stringify(wickrUser.ticket));
      console.log('325 wickrUser:', wickrUser)
      for (var i in ticketCopy.custom_fields) {
        if (ticketCopy.custom_fields[i].custom_field_options)
          delete ticketCopy.custom_fields[i].custom_field_options;
      }
      var ticket = {
        "ticket": {
          "subject": ticketCopy.subject,
          "comment": {
            "body": ticketCopy.comment.body
          },
          "requester": {
            "name": ticketCopy.requester.name,
            "email": ticketCopy.requester.email
          },
          "custom_fields": ticketCopy.custom_fields,
          "tags": ["bot_created"]
        }
      };
      console.log('Before creating ticket:', ticket)
      client.tickets.create(ticket, function(err, req, result) {
        if (err) {
          return callback(err);
        }
        console.log('Created Ticket:', JSON.stringify(result, null, 2, true));
        var ticketID = result.id;
        if (wickrUser.zendesk_id.length === 0)
          wickrUser.zendesk_id = JSON.parse(result.requester_id);
        wickrUser.tickets.push(JSON.stringify(result, null, 2, true));
        var response = 'Thanks for your feedback! Your Zendesk Ticket number is: ' + ticketID;
        var csrm = WickrIOAPI.cmdSendRoomMessage(wickrUser.current_vGroupID, response);
        return callback(wickrUser);
      });
    } catch (err) {
      console.log(err);
    }
  }
}).catch(error => {
  console.log(error);
});
