package main

import (
	//"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	//"os"
	"strings"
	//"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

// Define structs for authentication
type SignInRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type AuthResponse struct {
	JWT   string `json:"jwt"`
	Error string `json:"error,omitempty"`
}

type JWTClaims struct {
	UserID int    `json:"userId"`
	Login  string `json:"login"`
	jwt.StandardClaims
}

// Configuration settings
type Config struct {
	Port          string `json:"port"`
	APIEndpoint   string `json:"apiEndpoint"`
	AuthEndpoint  string `json:"authEndpoint"`
	ClientPath    string `json:"clientPath"`
}

var config Config

func main() {
	// Load configuration
	loadConfig()

	// Setup router
	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/api/auth/signin", handleSignIn).Methods("POST")
	r.HandleFunc("/api/proxy/graphql", proxyGraphQL).Methods("POST")

	// Serve static files
	staticFileHandler := http.FileServer(http.Dir(config.ClientPath))
	r.PathPrefix("/").Handler(staticFileHandler)

	// Configure CORS
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Start server
	port := config.Port
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

func loadConfig() {
	// Default configuration
	config = Config{
		Port:          "8080",
		APIEndpoint:   "https://01.kood.tech/api/graphql-engine/v1/graphql",
		AuthEndpoint:  "https://01.kood.tech/api/auth/signin",
		ClientPath:    "./client",
	}

	// Try to load config from file
	file, err := ioutil.ReadFile("config.json")
	if err == nil {
		json.Unmarshal(file, &config)
	}
}

func handleSignIn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse request body
	var signInReq SignInRequest
	err := json.NewDecoder(r.Body).Decode(&signInReq)
	if err != nil {
		respondWithError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Extract credentials from Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Basic ") {
		respondWithError(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	// Decode base64 credentials
	//credentials, err := base64.StdEncoding.DecodeString(authHeader[6:])
	if err != nil {
		respondWithError(w, "Invalid authorization format", http.StatusUnauthorized)
		return
	}

	// Forward the authentication request to the actual auth endpoint
	req, err := http.NewRequest("POST", config.AuthEndpoint, nil)
	if err != nil {
		respondWithError(w, "Server error", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Authorization", authHeader)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		respondWithError(w, "Authentication service unavailable", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		respondWithError(w, "Error reading authentication response", http.StatusInternalServerError)
		return
	}

	// Forward the response status and body
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func proxyGraphQL(w http.ResponseWriter, r *http.Request) {
	// Extract JWT from authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		respondWithError(w, "JWT required", http.StatusUnauthorized)
		return
	}

	// Create a new request to the GraphQL endpoint
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		respondWithError(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	req, err := http.NewRequest("POST", config.APIEndpoint, strings.NewReader(string(body)))
	if err != nil {
		respondWithError(w, "Server error", http.StatusInternalServerError)
		return
	}

	// Forward headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)

	// Execute request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		respondWithError(w, "GraphQL service unavailable", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		respondWithError(w, "Error reading GraphQL response", http.StatusInternalServerError)
		return
	}

	// Forward the response
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func respondWithError(w http.ResponseWriter, message string, statusCode int) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(AuthResponse{Error: message})
}