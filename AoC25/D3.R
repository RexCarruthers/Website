library(tidyverse)

ip <- get_input(2025, 3)

ip <- c("987654321111111",
        "811111111111119",
        "234234234234278",
        "818181911112111")

## PArt 1

ans <- 0

for (i in 1:length(ip)){
  
  one <- str_sub(ip[i], start = 1, end = str_length(ip[1])-1) %>% str_extract_all(pattern = "[:digit:]")
  one <- one[[1]] %>% max() %>% as.numeric()
  
  two <- str_sub(ip[i], str_locate(ip[i], as.character(one))[1,1]+1, str_length(ip[i]))
  two <- two %>% str_extract_all(pattern = "[:digit:]")
  two <- two[[1]] %>% max() %>% as.numeric()
  
  ans <- c(ans,as.numeric(paste0(one,two)))
  
}

## Part 2

options(scipen = 999)

ans <- 0

for (i in 1:length(ip)){
  
  a <- ip[i]
  ai <- ""
 
  for (s in 1:12){
    
    n <- str_sub(a, start = 1, end = str_length(a)-(12-s)) %>% str_extract_all(pattern = "[:digit:]")
    n <- n[[1]] %>% max() %>% as.numeric()
    
    ai <- c(ai,n)
    a <- str_sub(a, start = str_locate(a, as.character(n))[1,1]+1, end = str_length(a))
    
  }
  
  ans <- c(ans,as.numeric(str_flatten(ai)))
   
}

sum(ans)
