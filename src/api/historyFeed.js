export default async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({ message: 'Hello, World!' });
  //TODO: Have Brady implement error handling
  // fs.readJson('history-feed.json').then((response) => {
  //   res.status(200).json(response);
  // });
}
