library(tidyverse)

# Import data
ip <- readLines("W1input.txt")

ip <- c("L68","L30","R48","L5","R60","L55","L1","L99","R14","L82")

# Initialise variables
sp <- 50
zh <- 0

## Part 1

# Loop through each
for (i in 1:length(ip)){
  
  a <- str_extract(ip[i],"[:alpha:]")
  n <- as.numeric(str_extract(ip[i],"[:digit:]+"))
  
  n <- n - ((n %/% 100) * 100)
  
  if (a == "L"){
    sp <- sp - n
  } else {
    sp <- sp + n
  }
  
  if (sp > 99){
    sp <- sp - 100
  } else if (sp < 0){
    sp <- sp + 100
  }
  
  if (sp == 0){
    zh <- zh + 1
  }
  
}

## PArt 2

for (i in 1:length(ip)){
  
  a <- str_extract(ip[i],"[:alpha:]")
  n <- as.numeric(str_extract(ip[i],"[:digit:]+"))
  
  zh <- zh + (n %/% 100)
  n <- n - ((n %/% 100) * 100)
  
  if (a == "L"){
    sp <- sp - n
  } else {
    sp <- sp + n
  }
  
  if (sp > 99){
    if (z == 0 & sp != 100){
      zh <- zh + 1
    }
    sp <- sp - 100
  } else if (sp < 0){
    sp <- sp + 100
    if (z == 0){
      zh <- zh + 1
    }
  }
  
  z <- 0
  
  if (sp == 0){
    zh <- zh + 1
    z <- 1
  }
  
  print(paste("i:",i,"ip:",ip[i],"sp:",sp,"zh:",zh))
  
}

get_input <- function(year, day) {
  # Load necessary packages
  if (!requireNamespace("httr", quietly = TRUE)) install.packages("httr")
  if (!requireNamespace("readr", quietly = TRUE)) install.packages("readr")
  
  library(httr)
  library(readr)
  
  # Your Advent of Code session cookie
  # You can find this in your browser's developer tools after logging in.
  # It's recommended to store this securely, e.g., in an environment variable or a separate file.
  # For this example, we'll assume it's stored in a file named 'session.txt'.
  session_id <- readLines("session.txt")
  
  # Construct the URL for the puzzle input
  url <- paste0("https://adventofcode.com/", year, "/day/", day, "/input")
  
  # Make the GET request with the session cookie
  response <- GET(url, set_cookies(session = session_id))
  
  # Check if the request was successful
  if (http_status(response)$category == "Success") {
    # Extract the content and parse it as lines
    input_data <- content(response, encoding = "UTF-8") %>%
      read_lines()
    return(input_data)
  } else {
    stop(paste("Failed to retrieve input:", http_status(response)$reason))
  }
}
