# WickrIO Zendesk Bot

* Wickr's own Zendesk Bot

Use this bot to handle customer support and automatically create Zendesk tickets for users, all without leaving Wickr's secure messaging platform.
Just plug in your Zendesk account info and the bot will pull all the fields and questions required to submit a Ticket from the pre-configured Zendesk account and will prompt the user to enter them. Once the user confirms the information he entered the bots will submit the ticket to Zendesk.

To get started, you would need to setup your system, download and install Docker and run the WickrIO Docker container. Full instructions on how to do so are available here: https://wickrinc.github.io/wickrio-docs/#wickr-io-getting-started

## Configuration:
1. Go into your ZenDesk account and on the left side menu bar select the settings icon
2. Scroll down and find the "Channels" section, then select "API"
3. Create a new Active API Token under the "Token Access" section
4. Save the API token

* After installing the WickrIO Zendesk Bot, you will need to configure several properties that are needed to access your Zendesk account. The WickrIO console will walk you through entering the following values:
Required tokens:
1. DATABASE_ENCRYPTION_KEY - Choose a 16-character(minimum) string key to derive the crypto key from in order to encrypt and decrypt the user database of this bot. This must be specified, there is no default. NOTE: be careful not to change if reconfiguring the bot or else the user database won't be accessible.
2. BOT_USERNAME = This is the username of the WickrIO client. If prompted enter that value
3. ZENDESK_USERNAME = The username for the Zendesk Agent who's account will be used to submit all the tickets
4. ZENDESK_API_TOKEN = Zendesk API Key which is generated in the steps above
5. ZENDESK_DOMAIN_NAME = Can be found in the beginning of your Zendesk URL <domain>.zendesk.com(Usually the company's name)

## Description:
* /help@botName - List all available commands.
* /list@botName - Lists all tickets you have opened.(COMING SOON)
* /get@botName TICKET_ID - Retrieve the specified ticket.(COMING SOON)
* /resolve@botName TICKET_ID - Resolve the specified ticket.(COMING SOON)
