const Discord = require('discord.js');
const {prefix, token, status} = require('./config.json');
const ytdl = require('ytdl-core');

const { version } = require('./package.json');

const client = new Discord.Client();
client.login(token);

const commands = [

    // join-command
    {
        syntaxes: ['join', 'j'],
        label: 'Asks the bot to join to the server.',
        name: 'Join'
    },

    // play-command
    {
        syntaxes: ['play', 'p'],
        label: 'Add song to queue. Requires valid url from YouTube.',
        name: 'Play'
    },

    // skip-command
    {
        syntaxes: ['skip', 's'],
        label: 'Skips the current song playing.',
        name: 'Skip'
    },

    // queue-command
    {
        syntaxes: ['queue', 'q'],
        label: 'Displays the list of current songs in the queue.',
        name: 'Queue'
    },
    {
        syntaxes: ['help', 'h'],
        lable: 'Displays the list of commands',
        name: 'Help'
    }
]

const commandList = {
    join: commands[0],
    play: commands[1],
    skip: commands[2],
    queue: commands[3],
    help: commands[4]
}

const queue = new Map();

client.once('ready', () => {
    console.log('Ready!');
    client.user.setPresence({
        status: 'online',
        activity: {
            type: 'LISTENING',
            name: status
        }
    })
});

client.once('reconnecting', () => {
    console.log('reconnecting!');
});

client.once('disconnect', () => {
    console.log('Disconnected!');
});

client.on('message', async (message) => {
    if(message.author.bot) return;
    if(!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);
    const args = message.content.split(' ');
    const command = args[0].replace(prefix, '');

    // join-command
    if(commandList.join.syntaxes.includes(command)){
        const queueConstruct = await join(message.guild, message.member);
        queue.set(message.guild.id, queueConstruct);
        return;
    }

    // play-command
    if(commandList.play.syntaxes.includes(command)){
        return appendToQueue(message, serverQueue);
    }   

    //skip-command
    if(commandList.skip.syntaxes.includes(command)){
        return skipQueue(message, serverQueue);
    }

    //queue-command
    if(commandList.queue.syntaxes.includes(command)){
        return message.channel.send(displayQueue(serverQueue));
    }

    //help-command
    if(commandList.help.syntaxes.includes(command)){
        return message.channel.send(displayCommandList());
    }

    return message.channel.send(`Please send a valid command! Use ${prefix}help for help.`);
});

// detect when user joins
client.on('voiceStateUpdate', (oldState, newState) => {
    if(newState.member.user.bot) return;

    if(newState.channelID === null){
        
    }
    else if(oldState.channelID === null){
        playAudioFromUser(newState.guild, newState.member.user);
    }

});

// adds song to queue
const appendToQueue = async (message, serverQueue) => {
    const args = message.content.split(' ');

    const voiceChannel = message.member.voice.channel;

    if(!voiceChannel) return message.channel.send('You must be in a channel to run this command!');
    if(!args[1]) return message.channel.send('Please provide a valid url');

    try{
        const songInfo = await ytdl.getInfo(args[1]);

        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            author: songInfo.videoDetails.author.name
        }

        // create queue if it doesn't exist
        if(!serverQueue){
    
            const queueConstruct = await join(message.guild, message.member);
            queueConstruct.songs.push(song);
            queueConstruct.textChannel = message.channel;
    
            queue.set(message.guild.id, queueConstruct);
    
            return playAudioFromSong(message.guild, song);
    
        } else {
            serverQueue.songs.push(song);
            serverQueue.textChannel = message.channel;
            message.channel.send(`${song.title} has been added to the queue`);
        }

    } catch(err) { return message.channel.send("Couldn't find video with that url. Please double check your syntax") }


}

const skipQueue = (message, serverQueue) => {
    if(!message.member.voice.channel) return message.channel.send('You must be in a channel to run this command!');
    if(!serverQueue) return message.channel.send("There isn't any song playing!");
    if(serverQueue.songs.lenght == 0) return message.channel.send("There isn't any song playing!");

    serverQueue.connection.dispatcher.end();
}

const join = async (guild, member) => {
    return new Promise(async (resolve, reject) => {
        const voiceChannel = member.voice.channel;

        if(!member.voice.channel) return reject();
    
        const queueConstruct = {
            textChannel: null,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
    
        try{
            const connection = await voiceChannel.join();
            queueConstruct.connection = connection;
    
            console.log("Successfully connected!");
            return resolve(queueConstruct);
    
        } catch(err) {
            console.error(err);
            queue.delete(guild.id);
        }
    });
}

const playAudioFromSong = async (guild, song) => {
    const serverQueue = queue.get(guild.id);

    if(!serverQueue) return;

    if(!song){
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url, {filter: 'audioonly', quality: 'lowest'}))
    .on('finish', () => {
        serverQueue.songs.shift();
        playAudioFromSong(guild, serverQueue.songs[0]);
    })
    .on('error', (error) => {
        console.error(error)
        serverQueue.textChannel.send('YouTube blocked my bandwidth. Try again later');
        serverQueue.voiceChannel.leave();
    })

    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

const playAudioFromUser = (guild, user) => {
    console.log(`Playing intro for ${user.username}`);
    const connection = queue.get(guild.id).connection;
    connection.play(`./intros/Elina's-theme.mp3`);
}

const displayQueue = (serverQueue) => {
    if(!serverQueue) return 'Nothing has been played yet.';
    if(serverQueue.songs.lenght == 0) return 'The queue is currently empty.';
    
    const embed = new Discord.MessageEmbed()
    .setTitle('**Queue - Currently playing.**')
    .setColor('GREEN')

    serverQueue.songs.forEach(song => {
        embed.addField(`${song.author} : **${song.title}**`, song.url)
    });

    return embed;
}

const displayCommandList = () => {
    const embed = new Discord.MessageEmbed()
    .setTitle('Available commands')
    .setColor('GREEN')
    .setFooter(`v${version} - Tuukka Moilanen © 2020`)

    commands.forEach(command => {
        embed.addField(`**${command.name}** - ${command.label}`, command.syntaxes.map(syntax =>"`" + `${prefix}${syntax}` + "`"))
    })
    return embed;
}
