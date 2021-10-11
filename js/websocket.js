// type Protocol = { channel :: WebSocket }
// type Channel  = WebSocket
self.HNWWS =
  {
    status: {
      closed    : WebSocket.CLOSED
    , closing   : WebSocket.CLOSING
    , connecting: WebSocket.CONNECTING
    , open      : WebSocket.OPEN
    }
  };
