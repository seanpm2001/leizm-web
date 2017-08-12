import { Connect } from '../lib';

const app = new Connect();
app.use('/', async function (ctx) {
  console.log(ctx.request.query);
  ctx.next();
});
app.use('/', app.fromClassicalHandle(function (req: any, res: any, next: any) {
  console.log(req.headers);
  res.end('ok');
}));
console.log(app);
app.listen({ port: 3000 }, () => console.log('listening...'));

