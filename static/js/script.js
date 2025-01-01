document.querySelector(".addFileBtn").addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf";
    fileInput.multiple = true;

    fileInput.addEventListener("change", async (event) => {
        const files = event.target.files;
        const exactLoader = document.getElementById("loadingIndicator");
        exactLoader.style.display = "flex";

        if (files.length === 0) {
            alert("Please select at least one PDF file.");
            exactLoader.style.display = "none";
            return;
        }

        const formData = new FormData();
        for (let file of files) {
            formData.append("pdfs", file);
        }

        try {
            const response = await fetch("/upload_pdfs", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message || "PDFs uploaded successfully!");
                addPDFToUI(files);
            } else {
                alert(result.error || "An error occurred while uploading PDFs.");
            }
        } catch (error) {
            console.error("Error uploading PDFs:", error);
            alert("Failed to upload PDFs.");
        } finally {
            exactLoader.style.display = "none";
        }
    });

    fileInput.click();
});

function addPDFToUI(files) {
    const pdfList = document.getElementById("pdfList");

    Array.from(files).forEach((file) => {
        const listItem = document.createElement("li");

        const pdfIcon = document.createElement("div");
        pdfIcon.classList.add("pdf-icon");

        const pdfImage = document.createElement("img");
        pdfImage.src = pdfIconUrl;
        pdfImage.alt = "PDF Icon";

        const pdfName = document.createElement("span");
        pdfName.classList.add("pdf-name");
        pdfName.textContent = file.name;

        const removeBtn = document.createElement("button");
        removeBtn.classList.add("remove-btn");
        removeBtn.textContent = "×";

        removeBtn.addEventListener("click", () => {
            const confirmation = confirm(`Are you sure you want to remove "${file.name}"?`);
            if (confirmation) {
                listItem.remove(); // Remove from the UI
                removePDFFromBackend(file.name); // Notify the backend
            }
        });

        pdfIcon.appendChild(pdfImage);
        pdfIcon.appendChild(pdfName);
        listItem.appendChild(pdfIcon);
        listItem.appendChild(removeBtn);
        pdfList.appendChild(listItem);
    });

}

// async function removePDFFromBackend(fileName) {
//     try {
//         const response = await fetch("/remove_pdf", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ fileName }),
//         });

//         const result = await response.json();

//         if (response.ok) {
//             console.log(result.message || "PDF removed successfully.");
//         } else {
//             console.error(result.error || "An error occurred while removing the PDF.");
//         }
//     } catch (error) {
//         console.error("Error removing PDF:", error);
//     }
// }

// ------------------------------------------   handle the message ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
 const helloMessage = document.querySelector(".hello-what-can-i-help-you-with");
 const fullMessage = "Hello! What can I help you with?";
 const chatmessages = document.querySelector(".chat-messages");
 const messageInput = document.querySelector(".messageInput");
 const sendBtn = document.querySelector(".send-btn");

 setTimeout(() => {
     let i = 0;
     const messageElement = helloMessage.querySelector("span");
     
     // Clear the existing message and start typing the new message
     messageElement.textContent = '';
     
     const typingInterval = setInterval(() => {
         if (i < fullMessage.length) {
             messageElement.textContent += fullMessage.charAt(i); // Add one character at a time
             i++;
         } else {
             clearInterval(typingInterval); // Stop the typing effect once complete
         }
     }, 80); // Adjust speed here by changing the delay time
 }, 10); 

 // Function to handle sending the message
 const sendMessage = async () => {
     const userQuestion = messageInput.value.trim();

     if (!userQuestion) {
         alert("Please enter a question.");
         return;
     }

     // Display the user's message in the chat
     displayUserMessage(userQuestion);

     // Clear the textarea
     messageInput.value = "";

     helloMessage.style.display = "none";
     chatmessages.style.display = "block";

     const chatMessages = document.getElementById("chatMessages");

     // Create the loader for the bot response
     const loaderContainer = document.createElement("div");
     loaderContainer.classList.add("message-container", "bot-message-container");
     const loaderAvatar = document.createElement("img");
     loaderAvatar.src = botAvatarUrl;
     loaderAvatar.alt = "Bot Avatar";
     loaderAvatar.classList.add("avatar");
     const loader = document.createElement("div");
     loader.classList.add("dots-loader");
     loader.innerHTML = `<span></span><span></span><span></span>`;
     loaderContainer.appendChild(loaderAvatar);
     loaderContainer.appendChild(loader);
     chatMessages.appendChild(loaderContainer);
     scrollToBottom(chatMessages);

     try {
         const response = await fetch("/ask", {
             method: "POST",
             headers: {
                 "Content-Type": "application/json",
             },
             body: JSON.stringify({
                 question: userQuestion,
             }),
         });

         const result = await response.json();

         if (response.ok) {
             // Display the bot's response in the chat
             loaderContainer.remove();
             displayBotMessage(result.response);
         } else {
             loaderContainer.remove();
             alert(result.error || "An error occurred while fetching the answer.");
         }

     } catch (error) {
         console.error("Error asking the question:", error);
         loaderContainer.remove();
         alert("Failed to ask the question.");
     }

 };

 function displayUserMessage(message) {
 const chatMessages = document.getElementById("chatMessages");

 const messageContainer = document.createElement("div");
 messageContainer.classList.add("message-container", "user-message-container");

 const avatar = document.createElement("img");
 avatar.src = userAvatarUrl;
 avatar.alt = "User Avatar";
 avatar.classList.add("useravatar");

 const messageBubble = document.createElement("div");
 messageBubble.classList.add("message", "user-message");
 
 // Replace newlines with <br> tags to preserve line breaks
 messageBubble.innerHTML = message.replace(/\n/g, "<br>");

 const timestamp = document.createElement("span");
 timestamp.classList.add("timestamp");
 timestamp.textContent = new Date().toLocaleTimeString();

 messageContainer.appendChild(messageBubble);
 messageContainer.appendChild(avatar);
 messageContainer.appendChild(timestamp); // Append timestamp below message

 chatMessages.appendChild(messageContainer);
 scrollToBottom(chatMessages);
}

function displayBotMessage(message) {
 const chatMessages = document.getElementById("chatMessages");

 // Create the message container
 const messageContainer = document.createElement("div");
 messageContainer.classList.add("message-container", "bot-message-container");

 // Create the avatar
 const avatar = document.createElement("img");
 avatar.src = botAvatarUrl;
 avatar.alt = "Bot Avatar";
 avatar.classList.add("botavatar");

 // Create the message bubble
 const messageBubble = document.createElement("div");
 messageBubble.classList.add("message", "bot-message");

 // Replace newlines with <br> tags to preserve line breaks
 messageBubble.innerHTML = message.replace(/\n/g, "<br>");

 // Append the avatar and message bubble to the container
 messageContainer.appendChild(avatar);
 messageContainer.appendChild(messageBubble);

 // Append the container to the chat messages
 chatMessages.appendChild(messageContainer);

 // Scroll to the bottom
 scrollToBottom(chatMessages);
}

 function scrollToBottom(container) {
     container.scrollTop = container.scrollHeight;
 }

 // Listen for 'Enter' key press to trigger the send message
 messageInput.addEventListener("keydown", (event) => {
     if (event.key === "Enter" && !event.shiftKey) {
         event.preventDefault(); // Prevent the default action of adding a newline
         sendMessage(); // Trigger send message function when Enter is pressed without Shift
     } else if (event.key === "Enter" && event.shiftKey) {
         event.preventDefault(); // Prevent default newline behavior
         messageInput.value += "\n"; // Add a newline when Shift + Enter is pressed
     }
 });

 sendBtn.addEventListener("click", sendMessage);
});