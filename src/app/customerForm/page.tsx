"use client";
import React, { useState } from "react";

export default function CustomerFormPage() {
  const [step, setStep] = useState(1);
  const [planDuration, setPlanDuration] = useState("12");
  const [houseType, setHouseType] = useState("rent");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  
  // File States
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [residenceFile, setResidenceFile] = useState<File | null>(null);
  
  // OTP States
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  
  // Payment State
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    const isLoaded = await loadRazorpayScript();
    
    if (!isLoaded) {
      alert("Razorpay SDK failed to load. Are you online?");
      setIsProcessingPayment(false);
      return;
    }

    try {
      const amountStr = getPrice().replace(/,/g, '');
      const amount = parseInt(amountStr);

      const res = await fetch("http://localhost:5000/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        alert("Failed to create order: " + data.message);
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: "rzp_test_Swg0B14PfrFGrX", 
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Akvinz",
        description: `Subscription - ${planDuration} Months`,
        order_id: data.order.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("http://localhost:5000/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              setStep(3);
            } else {
              alert("Payment verification failed!");
            }
          } catch (e) {
            alert("Error verifying payment.");
          }
        },
        prefill: {
          contact: mobileNumber,
        },
        theme: {
          color: "#f26522"
        }
      };
      
      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
      
      paymentObject.on('payment.failed', function (response: any){
        alert("Payment Failed: " + response.error.description);
      });
      
    } catch (e) {
      alert("Error initiating payment");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendOtp = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setOtpError("Please enter a valid mobile number.");
      return;
    }
    setIsSendingOtp(true);
    setOtpError("");
    try {
      const res = await fetch("http://localhost:5000/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: "+91" + mobileNumber.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpError("");
      } else {
        setOtpError(data.message || "Failed to send OTP.");
      }
    } catch (e) {
      setOtpError("Error sending OTP. Please check your backend.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError("");
    try {
      const res = await fetch("http://localhost:5000/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: "+91" + mobileNumber.replace(/\D/g, ""), code: otpCode }),
      });
      const data = await res.json();
      if (data.verified) {
        setOtpVerified(true);
        setOtpError("");
      } else {
        setOtpError(data.message || "Invalid OTP. Try again.");
      }
    } catch (e) {
      setOtpError("Error verifying OTP.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) {
      alert("Please verify OTP first");
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("mobileNumber", mobileNumber);
      formData.append("email", email);
      formData.append("addressLine1", addressLine1);
      formData.append("addressLine2", addressLine2);
      formData.append("city", city);
      formData.append("state", stateName);
      formData.append("pincode", pincode);
      formData.append("planDuration", planDuration);
      formData.append("houseType", houseType);
      
      if (aadharFile) formData.append("aadharFile", aadharFile);
      if (panFile) formData.append("panFile", panFile);
      if (residenceFile) formData.append("residenceFile", residenceFile);

      const res = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.success) {
        setCustomerId(data.customerId);
        setStep(2);
      } else {
        alert("Registration failed: " + data.message);
      }
    } catch (error) {
      alert("Error saving details");
    }
  };

  const getPrice = () => {
    return planDuration === "12" ? "2,999" : "3,999";
  };

  return (
    <div className="min-h-screen bg-[#131724] text-white flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="bg-[#1a1f30] flex items-center justify-between px-4 py-3 shadow-md sticky top-0 z-10 border-b border-gray-800">
        <button type="button" className="p-2 text-gray-400 hover:text-white rounded-md transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <div className="flex justify-center items-center">
          <img src="/logo-footer.svg" alt="AKVINZ Logo" className="h-8 object-contain" />
        </div>
        <div className="flex space-x-2">
          <button type="button" className="p-2 bg-[#f26522]/10 text-[#f26522] rounded-full hover:bg-[#f26522]/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
            </svg>
          </button>
          <button type="button" className="p-2 bg-gray-800 text-gray-400 rounded-full hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-3xl mx-auto w-full px-4 py-10 relative">
        {/* Subtle background pipes pattern can be added here if needed, keeping it simple for now */}
        
        {/* Title Section */}
        {step < 3 && (
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <svg className="w-3 h-3 text-[#f26522]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              <span className="text-[#f26522] text-sm font-semibold tracking-wider uppercase">Step {step} of 2</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {step === 1 ? "Customer Registration" : "Payment Details"}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              {step === 1 ? "Welcome to Akvinz! Please provide your details and required documentation to complete your registration." : "Review your selected plan and complete the secure payment to finish your registration."}
            </p>
          </div>
        )}

        {step === 1 && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          
          {/* Subscription Plan Card */}
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-[#f26522]/10 flex items-center justify-center text-[#f26522]">
                <span className="font-bold text-sm">01</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Subscription Plan</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-2 ml-1 sm:ml-11">
              <label className="flex items-center cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${planDuration === '12' ? 'border-[#f26522]' : 'border-gray-500 group-hover:border-gray-400'}`}>
                  {planDuration === '12' && <div className="w-2.5 h-2.5 bg-[#f26522] rounded-full"></div>}
                </div>
                <input type="radio" name="plan_duration" value="12" checked={planDuration === "12"} onChange={() => setPlanDuration("12")} className="hidden" />
                <span className={`text-base ${planDuration === '12' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>12 Months Plan</span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${planDuration === '24' ? 'border-[#f26522]' : 'border-gray-500 group-hover:border-gray-400'}`}>
                  {planDuration === '24' && <div className="w-2.5 h-2.5 bg-[#f26522] rounded-full"></div>}
                </div>
                <input type="radio" name="plan_duration" value="24" checked={planDuration === "24"} onChange={() => setPlanDuration("24")} className="hidden" />
                <span className={`text-base ${planDuration === '24' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>24 Months Plan</span>
              </label>
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-[#f26522]/10 flex items-center justify-center text-[#f26522]">
                <span className="font-bold text-sm">02</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Personal Information</h2>
            </div>
            
            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="block w-full pl-12 pr-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="John Doe" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Mobile Number & OTP Verification */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm text-gray-300 mb-2">Mobile Number</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                        </svg>
                      </div>
                      <input 
                        type="tel" 
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        disabled={otpVerified}
                        className={`block w-full pl-12 pr-4 py-3 bg-[#131724] border rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors ${otpVerified ? 'border-green-500/50 opacity-70' : 'border-gray-700'}`} 
                        placeholder="Enter 10 digit number" 
                      />
                    </div>
                    
                    {!otpVerified && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || mobileNumber.length < 10}
                        className="whitespace-nowrap px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-colors disabled:opacity-50"
                      >
                        {isSendingOtp ? "Sending..." : (otpSent ? "Resend OTP" : "Send OTP")}
                      </button>
                    )}
                    
                    {otpVerified && (
                      <div className="flex items-center justify-center px-4 py-3 bg-green-500/10 text-green-400 font-medium rounded-xl border border-green-500/20">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Verified
                      </div>
                    )}
                  </div>
                  
                  {otpSent && !otpVerified && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter 6-digit OTP" 
                        className="block w-full sm:w-1/2 px-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors text-center tracking-[0.5em]"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpCode.length !== 6}
                        className="w-full sm:w-auto px-6 py-3 bg-[#f26522] hover:bg-[#e05a1e] text-white font-medium rounded-xl shadow-lg shadow-[#f26522]/20 transition-all disabled:opacity-50"
                      >
                        {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                  )}
                  
                  {otpError && (
                    <p className="mt-2 text-sm text-red-400">{otpError}</p>
                  )}
                </div>

                {/* Email ID */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm text-gray-300 mb-2">Email ID</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-12 pr-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="john@example.com" />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-2">
                <label className="block text-sm text-gray-300">Full Address</label>
                
                {/* Address Line 1 */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                  </div>
                  <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="block w-full pl-12 pr-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="House No., Building Name, Street Area" />
                </div>

                {/* Address Line 2 */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </div>
                  <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="block w-full pl-12 pr-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="Locality, Landmark (Optional)" />
                </div>

                {/* City, State, Pincode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative">
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="block w-full px-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="City" />
                  </div>
                  <div className="relative">
                    <input type="text" value={stateName} onChange={(e) => setStateName(e.target.value)} className="block w-full px-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="State" />
                  </div>
                  <div className="relative">
                    <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} className="block w-full px-4 py-3 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white placeholder-gray-600 transition-colors" placeholder="Pincode" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Identity Documents Card */}
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-[#f26522]/10 flex items-center justify-center text-[#f26522]">
                <span className="font-bold text-sm">03</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Identity Documents</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Aadhaar Upload */}
              <div>
                <span className="block text-sm text-gray-300 mb-2">Aadhaar Card Image</span>
                <label className="border border-dashed border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#131724]/50 hover:border-[#f26522] hover:bg-[#131724] transition-all cursor-pointer group block w-full relative">
                  <svg className="w-8 h-8 text-gray-500 mb-3 group-hover:text-[#f26522] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <p className="text-sm text-gray-400 mb-1">
                    {aadharFile ? (
                      <span className="text-[#f26522] font-semibold">{aadharFile.name}</span>
                    ) : (
                      <><span className="text-[#f26522] font-semibold">Choose File</span> or drag & drop</>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG or PDF (Max 5MB)</p>
                  <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setAadharFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              {/* PAN Upload */}
              <div>
                <span className="block text-sm text-gray-300 mb-2">PAN Card Image</span>
                <label className="border border-dashed border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#131724]/50 hover:border-[#f26522] hover:bg-[#131724] transition-all cursor-pointer group block w-full relative">
                  <svg className="w-8 h-8 text-gray-500 mb-3 group-hover:text-[#f26522] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <p className="text-sm text-gray-400 mb-1">
                    {panFile ? (
                      <span className="text-[#f26522] font-semibold">{panFile.name}</span>
                    ) : (
                      <><span className="text-[#f26522] font-semibold">Choose File</span> or drag & drop</>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG or PDF (Max 5MB)</p>
                  <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setPanFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          </div>

          {/* Residence Status Card */}
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded bg-[#f26522]/10 flex items-center justify-center text-[#f26522]">
                <span className="font-bold text-sm">04</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Residence Status</h2>
            </div>
            <p className="text-sm text-gray-400 mb-6 ml-1 sm:ml-11">
              Please select your residence type and provide the corresponding document.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6 ml-1 sm:ml-11">
              <label className="flex items-center cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${houseType === 'permanent' ? 'border-[#f26522]' : 'border-gray-500 group-hover:border-gray-400'}`}>
                  {houseType === 'permanent' && <div className="w-2.5 h-2.5 bg-[#f26522] rounded-full"></div>}
                </div>
                <input type="radio" name="residence" value="permanent" checked={houseType === "permanent"} onChange={() => setHouseType("permanent")} className="hidden" />
                <span className={`text-base ${houseType === 'permanent' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>Permanent House</span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${houseType === 'rent' ? 'border-[#f26522]' : 'border-gray-500 group-hover:border-gray-400'}`}>
                  {houseType === 'rent' && <div className="w-2.5 h-2.5 bg-[#f26522] rounded-full"></div>}
                </div>
                <input type="radio" name="residence" value="rent" checked={houseType === "rent"} onChange={() => setHouseType("rent")} className="hidden" />
                <span className={`text-base ${houseType === 'rent' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>Rent House</span>
              </label>
            </div>

            {/* Conditional Upload Box */}
            <div className="bg-[#131724] border border-gray-700 rounded-xl p-5 ml-0 sm:ml-11">
              <span className="block text-sm font-medium text-gray-300 mb-3">
                {houseType === "permanent" ? "EB Bill Image (Required for Permanent House)" : "Rental Agreement Image (Required for Rent House)"}
              </span>
              <label className="border border-gray-600 rounded-lg p-3 flex flex-col sm:flex-row items-center sm:justify-between gap-3 cursor-pointer hover:border-[#f26522] transition-colors group bg-[#1a1f30] block w-full relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-gray-800 text-gray-400 group-hover:text-[#f26522] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      {residenceFile ? (
                        <span className="text-[#f26522] font-semibold">{residenceFile.name}</span>
                      ) : (
                        <><span className="text-[#f26522] font-semibold">Choose File</span> or drag & drop</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto text-left sm:text-right">
                    <p className="text-xs text-gray-500">PNG, JPG or PDF (Max 5MB)</p>
                </div>
                <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setResidenceFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-6">
            <button 
              type="submit" 
              disabled={!otpVerified}
              className={`w-full font-semibold py-4 px-4 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-[0.98] ${otpVerified ? 'bg-[#f26522] hover:bg-[#e05a1e] text-white shadow-[#f26522]/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
            >
              <span className="text-lg">Continue to Next Step</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
              </svg>
            </button>
            <div className="mt-5 flex items-center justify-center gap-2 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              <span className="text-xs font-medium uppercase tracking-wider">Your information is secure and encrypted</span>
            </div>
          </div>

        </form>
        )}

        {step === 2 && (
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-8 max-w-xl mx-auto mt-4">
            <div className="flex items-center justify-between border-b border-gray-700/50 pb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Akvinz Subscription</h3>
                <p className="text-gray-400 mt-1">{planDuration} Months Plan</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 line-through">₹{planDuration === "12" ? "4,999" : "7,999"}</p>
                <p className="text-3xl font-bold text-[#f26522]">₹{getPrice()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Base Price</span>
                <span className="text-white font-medium">₹{getPrice()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Taxes & Fees</span>
                <span className="text-white font-medium text-green-400">Included</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold pt-4 border-t border-gray-700/50">
                <span className="text-white">Total Amount</span>
                <span className="text-[#f26522]">₹{getPrice()}</span>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="button" 
                onClick={handlePayment}
                disabled={isProcessingPayment}
                className="w-full bg-[#f26522] hover:bg-[#e05a1e] text-white font-semibold py-4 px-4 rounded-xl shadow-lg shadow-[#f26522]/20 flex justify-center items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <span className="text-lg">{isProcessingPayment ? "Processing..." : "Pay with Razorpay"}</span>
                {!isProcessingPayment && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                  </svg>
                )}
              </button>
              <div className="mt-5 flex items-center justify-center gap-2 text-green-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                <span className="text-xs font-medium uppercase tracking-wider">Secured by Razorpay</span>
              </div>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                disabled={isProcessingPayment}
                className="w-full mt-4 text-gray-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                ← Back to Registration
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-[#1a1f30]/80 border border-gray-700/50 rounded-2xl p-8 sm:p-12 backdrop-blur-sm text-center max-w-xl mx-auto mt-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Registration Successful!</h2>
            <p className="text-gray-400 mb-8">
              Thank you for choosing Akvinz. Your payment has been successfully received and your registration is complete.
            </p>
            <button 
              type="button" 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}