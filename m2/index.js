const express = require('express');
const amqp = require('amqplib');

const app = express();

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const SECOND = process.env.SECOND || "second";

let channel, connection;

async function connect() {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(SECOND);
  }
  
  connect().then(() => {
    console.log(' [x] Awaiting RPC requests');
    channel.consume(SECOND, data => {
        console.log("Consuming from SECOND queue");
        const { number } = JSON.parse(data.content);
        const { correlationId } = data.properties;
        const result = number * 2;

        console.log(`Получено число ${number} c id ${correlationId}, ответ: ${result}`);
        

        setTimeout(() => {
          console.log(`Отправка ответа: ${result} в ${data.properties.replyTo} queue`);
          channel.sendToQueue(data.properties.replyTo, Buffer.from(JSON.stringify({ result })), {correlationId});
        }, 5000); // Имитация задержки обработки

        channel.ack(data);
    })
}).catch(console.error);

app.listen(4000, () => {
  console.log("Второй сервис запущен на порту 4000");
});
