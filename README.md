# BURGER-LOGGER-APP

## Overview

* Create a burger logger with MySQL, Node, Express, Handlebars and a homemade ORM. 
* Follow the MVC design pattern; 
* Use Node and MySQL to query and route data in the application
* Handlebars to generate your HTML.

### App Guidance

* Eat-Da-Burger! is a restaurant app that lets users input the names of burgers they'd like to eat.

* Whenever a user submits a burger's name, it will display the burger on the left side of the page -- waiting to be devoured.

* Each burger in the waiting area also has a `Devour it!` button. When the user clicks it, the burger will move to the right side of the page.

* It will store every burger in a database, whether devoured or not.

* [Check out this video of the app for a run-through of how it works](https://youtu.be/msvdn95x9OM).

### Directory structure

All the recommended files and directories from the steps above should look like the following structure:

```
.
├── config
│   ├── connection.js
│   └── orm.js
│ 
├── controllers
│   └── burgers_controller.js
│
├── db
│   ├── schema.sql
│   └── seeds.sql
│
├── models
│   └── burger.js
│ 
├── node_modules
│ 
├── package.json
│
├── public
│   └── assets
│       ├── css
│       │   └── burger_style.css
│       └── img
│           └── burger.png
│   
│
├── server.js
│
└── views
    ├── index.handlebars
    └── layouts
        └── main.handlebars
```
- - -

### Hosting on Heroku

Now that we have a backend to our applications, we use Heroku for hosting. Please note that while **Heroku is free**, it will request credit card information if you have more than 5 applications at a time or are adding a database.

Please see [Heroku’s Account Verification Information](https://devcenter.heroku.com/articles/account-verification) for more details.

### Reminder

When trying to connect remotely to your Heroku database on an open network such as a coffee shop, library, or even your University WiFi, it will be blocked. If experiencing a Heroku connection error, this could be why.

**Good Luck!**
________________
<sub> &copy; Paul Xu at Univerversity of Toronto School of Continuing Studies Coding Boot Camp in March 2019 </sub>
