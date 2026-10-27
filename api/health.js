module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    mode: 'unconfigured',
    database: null,
    message: 'No DATABASE_URL configured; frontend uses browser demo mode.',
  });
};
