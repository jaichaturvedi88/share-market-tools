from livereload import Server

server = Server()

# watch files
server.watch("web/index.html")
server.watch("web/styles.css")
server.watch("web/js/*.js")

# start server
server.serve(root="web", port=5500)
