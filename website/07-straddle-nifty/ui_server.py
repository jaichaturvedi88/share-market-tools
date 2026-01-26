from livereload import Server

server = Server()

# watch files
server.watch("index.html")
server.watch("web/styles.css")
server.watch("web/js/*.js")

# start server
server.serve(root=".", port=5500)
