from livereload import Server

server = Server()

# watch files
server.watch("index.html")
server.watch("styles.css")
server.watch("js/*.js")

# start server
server.serve(root=".", port=5500)
