// Note: You CANNOT put a dash in the collection name or it will be a syntax error
chatRoom = new Mongo.Collection("chatRoom");
messages = new Mongo.Collection("messages");
greetings = new Mongo.Collection("greetings");
user_settings = new Mongo.Collection("userSettings");
requests = new Mongo.Collection("requests");


if (Meteor.isClient) {

// =======================================
// TEMPLATE HELPERS
// =======================================

    Template.listOfOverallUsers.helpers({
        userInCollection: function(){
            return Meteor.users.find();
        }
    })

    Template.friendList.helpers({
        // [ ] return an array of the logged in user's friends
        friends: function() {
            var friendObjects = []
            var friendIdArray = user_settings.find( { id: Meteor.userId() } ).fetch()[0].friendList;
            for (i = 0; i < friendIdArray.length; i++) {
                friendObjects.push(Meteor.users.findOne( friendIdArray[i] ));
            }

            return friendObjects
        }
    });

    Template.greetingList.helpers({
        // [ ] return greetings that belong to the user or any of the the user's friends
        greetings: function() {
            return greetings.find({},{sort: {dateCreated: -1}}).fetch();
        }
    });

    Template.friendRequests.helpers({
        // [ ] return all the requests that are directed to the user from someone that isn't a friend
        requests: function() { 
            console.log()
            return requests.find( { userId: Meteor.userId() } ).fetch()[0].friendRequests[1];
        }
    });

    Template.chatRooms.helpers({
        // [ ] return all the chatrooms that the user is a part of
        chatRooms: function() {
            //return array of chat room ids
            return chatRoom.find({ userIds: { $in: [Meteor.userId()] }}, { _id: true }).fetch()
        }
    })

    Template.chatHeader.helpers({
        // [ ] return the members in the active chat, minus the logged in user
        chatName: function(){
            
            return "First Lastname"

        }
    })

    Template.chatRoomNumber.events({
        // [ ] set the active chat session to the chat_id of the chatroom item that was clicked
        "click .chatroom-item": function () {
            // Set the checked property to the opposite of its current value
            console.log(this._id.toString());
            console.log("button is clicked!");
            Session.set("currentRoomId", this._id);
            $("#userMessage").focus();
          }
    })

    Template.chatRoomNumber.helpers({
        user: function(){
            var targetId
            userIdArray = chatRoom.find({ _id: this._id }).fetch()[0].userIds
            if (userIdArray[0] == Meteor.userId()){
                targetId = userIdArray[1]
            } else {
                targetId = userIdArray[0]
            }

            return Meteor.users.find({_id: targetId}).fetch()[0]
        }
    })


    Template.body.helpers({
        // [ ] return true if there is an active chat right now
        validChat: function(){
            return Session.get("currentRoomId")
        }
    })


    Template.chatRoomMessages.helpers({
        // return the chat messages from a certain user that have the active chatroom's id in their chatroom_id field
        chatMessages: function(){
            var messagesArray = []

            if (Session.get("currentRoomId") != undefined) {
                messagesArray = messages.find({currChatRoom: Session.get("currentRoomId")});
                console.log("currentRoomId: " + Session.get("currentRoomId"))
                console.log("messagesArray: " + messagesArray.fetch()[0]);
            }

            return messagesArray;

            
        }
    });

// =======================================
// TEMPLATE EVENTS
// =======================================

    Template.addFriendModalTemplate.events({
        "keyup #addFriendInput": function(event){
            if (event.which == 13) {
                Meteor.call('addFriend', $("#addFriendInput").val())
                $("#addFriendInput").val('')
                $("#addFriendModal").modal('hide')
            }
        } 
    })

    Template.addGreetingModalTemplate.events({
        "keyup #addGreetingInput": function(event) {
            if (event.which == 13) {
                Meteor.call('addGreeting', $("#addGreetingInput").val())
                $("#addGreetingInput").val('')
                $("#addGreetingModal").modal('hide')
            }
        }
    })

    Template.userChatMessageIn.events({
        "submit .new-message": function(){
            var message = event.target.chatText.value;
            console.log("message submitted:"+message);
            messages.insert({
                owner: Meteor.user(),                
                userMessages: message,
                dateCreated: new Date(),
                currChatRoom: Session.get("currentRoomId")
            });

            //Clear Form
            event.target.chatText.value = "";
            return false
        }
    });

    Template.greeting.events({
        'click .greeting-item': function(){
            console.log(this.owner._id);
            if (this.owner._id != Meteor.userId()) {
                Meteor.call('checkChat', this.owner._id)
            }
        }
    })

    Template.friend.events({
        'click .friend-item': function(){
            console.log(this._id);
            Meteor.call('checkChat', this._id)
        }
    });

    Template.request.events({
        'click .pull-right': function(){
            Meteor.call('addFriendFromRequest', this._id)
        }
    });

// =======================================
// HANDLEBARS HELPERS
// =======================================

    Handlebars.registerHelper("prettifyDate", function(timestamp){
        return moment(new Date(timestamp)).fromNow();
    });

    Handlebars.registerHelper("chatRoomHelper", function(chatRoomID){
        return messages.find({ currChatRoom: chatRoomID }).fetch();
    })

    Handlebars.registerHelper("getAvatar", function(user){
        return user.services.twitter.profile_image_url_https
    })

    Handlebars.registerHelper("getName", function(user){
        return user.profile.name
    })

}

// =======================================
// METEOR METHODS
// =======================================

    Meteor.methods({
        addFriend: function (friendScreenName){
            var dontAdd = true;
            // Make sure the user is logged in before inserting a task
            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            var friendToAdd = Meteor.users.find({ 'services.twitter.screenName': friendScreenName }).fetch();
            var friendToAddId = friendToAdd[0]._id;
            console.log("adding: "+ friendScreenName + "with id: "+ friendToAddId);

            //if friend is a real person
            if (friendToAdd.length == 1) {
                //if friend is not in friendlist, then send invite
                if (user_settings.find({ userId: Meteor.userId() }).fetch().length == 0) {
                    console.log("adding friend");
                    //if requests for this user is empty, init friend request list for user
                    if(requests.find({ userId: Meteor.userId() }).fetch().length == 0){
                        requests.insert({ userId: Meteor.userId() });
                    }
                    else{
                        //if friendToAdd is in friendRequests of current user
                        var listOfFriends = requests.find( { userId: Meteor.userId() } ).fetch()[0].friendRequests;
                        console.log(listOfFriends);
                        
                        for(i = 0;i<listOfFriends.length;i++){
                            if(listOfFriends[i]._id == friendToAddId){
                                dontAdd = false;
                            }
                        } 
                    }
                    if(dontAdd == true){
                        requests.update({ userId: Meteor.userId() }, { $addToSet: { friendRequests: friendToAdd }});
                    }
                }
                else{
                    alert("already in friendlist");
                }
            }
            else{
                //invite a friend
                alert("friend is not signed up for Merge.im yet")
            }
        },

        addGreeting: function(greetingContent) {
            var ownerObject = Meteor.users.find({ _id: Meteor.userId() }).fetch()[0];
            greetings.insert({ content: greetingContent, dateCreated: new Date(), owner: ownerObject })
        },

        addMessage: function(chatRoomID, messageContent) {
            var XmlApi = Meteor.npm.Require('xml-parser');
            var parse = new XmlApi({
                version: "1.2.0"
            });

            //if the message prefix is "/wolfram"
            if(messageContent.substring(0, 7) == "/wolfram"){
                var getResponse = Meteor.http.get("http://api.wolframalpha.com/v2/query?input=" + messageContent.substring(9, messageContent.length()) + "&appid=PG9HJR-46KYVEWH2J", {timeout:30000})
                var xmlParsed = parse(getResponse.content);
                console.log(xmlParsed);
            }
            else{
                messages.insert({ parent: chatRoomID, content: messageContent, dateCreated: new Date(), owner: Meteor.userId() });
            }
        },

        checkChat: function(userID){
            var temp = chatRoom.find({ userIds: [Meteor.userId(), userID] }).fetch()
            var temp2 = chatRoom.find({ userIds: [userID, Meteor.userId()] }).fetch()
            console.log("temp: " + temp);
            console.log("temp2: "+ temp2);
            if (temp.length == 1){
                Session.set("currentRoomId", temp._id);
            }
            else if(temp2.length == 1){
                Session.set("currentRoomId", temp2._id)
            }
            else{
                chatRoom.insert({ userIds: [Meteor.userId(), userID], modsActivated: [] });
                var currentRoom = chatRoom.find({ userIds: [Meteor.userId(), userID] }).fetch()[0];
                Session.set("currentRoomId", currentRoom._id);
            } 
        },      

        addFriendFromRequest: function(userToAdd){
            //get the user object
            var temp = Meteor.users.find({_id: userToAdd});
            //add to friends list
            user_settings.update({id: Meteor.userId()}, {$addToSet: {friendList: temp} });
            //remove from both this user and the user who is getting accepted 
            requests.update({userId: Meteor.userId()}, {$pull: {requestList: temp._id}});
        }

    });




