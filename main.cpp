/*  =========================================================
    main.cpp  —  Cross-Platform C++ HTTP Micro-Server
    Supports: Windows (Winsock2) + macOS / Linux (POSIX sockets)
    ========================================================= */

#include "TrafficController.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstring>
#include <thread>
#include <mutex>

// ── Platform socket abstraction ────────────────────────────────────────────
#ifdef _WIN32
    #define WIN32_LEAN_AND_MEAN
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")

    typedef SOCKET  sock_t;
    typedef int     socklen_t;
    #define SOCK_INVALID INVALID_SOCKET
    #define SOCK_ERR     SOCKET_ERROR
    #define closesocket_ closesocket
    static ssize_t sock_read(sock_t s, char* buf, int len) {
        return (ssize_t)recv(s, buf, len, 0);
    }
    static ssize_t sock_write(sock_t s, const char* buf, int len) {
        return (ssize_t)send(s, buf, len, 0);
    }
#else
    #include <unistd.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    typedef int     sock_t;
    #define SOCK_INVALID (-1)
    #define SOCK_ERR     (-1)
    #define closesocket_ close
    static ssize_t sock_read(sock_t s, char* buf, int len) {
        return read(s, buf, len);
    }
    static ssize_t sock_write(sock_t s, const char* buf, int len) {
        return write(s, buf, len);
    }
#endif
// ──────────────────────────────────────────────────────────────────────────

TrafficController g_controller;
std::mutex        g_mutex;

std::string getMimeType(const std::string& path) {
    if (path.find(".html") != std::string::npos) return "text/html";
    if (path.find(".css")  != std::string::npos) return "text/css";
    if (path.find(".js")   != std::string::npos) return "application/javascript";
    if (path.find(".json") != std::string::npos) return "application/json";
    return "text/plain";
}

std::string readFileContent(const std::string& filepath) {
    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) return "";
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

// Strip query string from URL for file serving (e.g. "style.css?v=3" -> "style.css")
std::string stripQuery(const std::string& url) {
    size_t q = url.find('?');
    return (q != std::string::npos) ? url.substr(0, q) : url;
}

void handleClient(sock_t clientSocket) {
    char buffer[4096] = {0};
    ssize_t bytesRead = sock_read(clientSocket, buffer, sizeof(buffer) - 1);
    if (bytesRead <= 0) {
        closesocket_(clientSocket);
        return;
    }

    std::string request(buffer);
    std::istringstream requestStream(request);
    std::string method, url, protocol;
    requestStream >> method >> url >> protocol;

    std::string responseBody = "";
    std::string contentType  = "application/json";
    int         statusCode   = 200;

    std::lock_guard<std::mutex> lock(g_mutex);

    if (url.rfind("/api/state", 0) == 0) {
        responseBody = g_controller.toJSON();

    } else if (url.rfind("/api/action", 0) == 0) {
        // Parse query params
        std::string actionType = "";
        std::string road       = "";

        size_t queryPos = url.find("?");
        if (queryPos != std::string::npos) {
            std::string query = url.substr(queryPos + 1);
            std::istringstream qs(query);
            std::string kv;
            while (std::getline(qs, kv, '&')) {
                size_t eq = kv.find("=");
                if (eq != std::string::npos) {
                    std::string k = kv.substr(0, eq);
                    std::string v = kv.substr(eq + 1);
                    if (k == "type") actionType = v;
                    if (k == "road") road = v;
                }
            }
        }

        if      (actionType == "add_car")       g_controller.addCar(road);
        else if (actionType == "remove_car")    g_controller.removeCar(road);
        else if (actionType == "send_ambulance")g_controller.sendAmbulance(road);
        else if (actionType == "step")          g_controller.tick();
        else if (actionType == "randomize")     g_controller.randomize();

        responseBody = g_controller.toJSON();

    } else {
        // Static file serving
        std::string filePath = stripQuery(url);
        if (filePath == "/" || filePath == "/index.html") {
            filePath = "index.html";
        } else if (!filePath.empty() && filePath[0] == '/') {
            filePath = filePath.substr(1);
        }

        responseBody = readFileContent(filePath);
        if (responseBody.empty()) {
            statusCode   = 404;
            responseBody = "404 Not Found";
            contentType  = "text/plain";
        } else {
            contentType = getMimeType(filePath);
        }
    }

    std::stringstream header;
    header << "HTTP/1.1 " << statusCode << " OK\r\n";
    header << "Content-Type: "   << contentType       << "\r\n";
    header << "Content-Length: " << responseBody.size()<< "\r\n";
    header << "Access-Control-Allow-Origin: *\r\n";
    header << "Connection: close\r\n\r\n";

    std::string fullResponse = header.str() + responseBody;
    sock_write(clientSocket, fullResponse.c_str(), (int)fullResponse.size());
    closesocket_(clientSocket);
}

int main() {
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "WSAStartup failed." << std::endl;
        return 1;
    }
#endif

    sock_t serverFd = socket(AF_INET, SOCK_STREAM, 0);
    if (serverFd == SOCK_INVALID) {
        std::cerr << "Failed to create socket." << std::endl;
        return 1;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(serverFd, SOL_SOCKET, SO_REUSEADDR,
               (const char*)&opt, sizeof(opt));
#else
    setsockopt(serverFd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in address{};
    address.sin_family      = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port        = htons(8080);

    if (bind(serverFd, (struct sockaddr*)&address, sizeof(address)) == SOCK_ERR) {
        std::cerr << "Bind failed on port 8080." << std::endl;
        closesocket_(serverFd);
        return 1;
    }

    if (listen(serverFd, 10) == SOCK_ERR) {
        std::cerr << "Listen failed." << std::endl;
        closesocket_(serverFd);
        return 1;
    }

    std::cout << "=========================================================" << std::endl;
    std::cout << "  C++ Traffic Engine HTTP Server — Listening on port 8080  " << std::endl;
    std::cout << "  Open: http://localhost:8080                               " << std::endl;
    std::cout << "  Press Ctrl+C to stop.                                    " << std::endl;
    std::cout << "=========================================================" << std::endl;

    while (true) {
        sockaddr_in clientAddr{};
        socklen_t   addrLen     = sizeof(clientAddr);
        sock_t      clientSocket = accept(serverFd,
                                          (struct sockaddr*)&clientAddr,
                                          &addrLen);
        if (clientSocket != SOCK_INVALID) {
            std::thread(handleClient, clientSocket).detach();
        }
    }

    closesocket_(serverFd);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
